/**
 * App Store Connect API Client
 *
 * Handles HTTP requests with automatic token refresh, rate limiting, and retry logic.
 */

import type { TokenManager } from "../auth/jwt.js";
import { ASCError, RateLimitError, parseAPIError } from "../utils/errors.js";
import type { ASCListResponse } from "./types.js";

const BASE_URL = "https://api.appstoreconnect.apple.com/v1";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Self-imposed rate limiting: 50 requests per minute
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 50;

interface RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeout?: number;
}

interface RateLimiter {
  timestamps: number[];
}

/**
 * App Store Connect API Client
 */
export class AppStoreConnectClient {
  private readonly tokenManager: TokenManager;
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter = { timestamps: [] };

  constructor(tokenManager: TokenManager, baseUrl = BASE_URL) {
    this.tokenManager = tokenManager;
    this.baseUrl = baseUrl;
  }

  /**
   * Make a GET request
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>({ method: "GET", path, params });
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ method: "POST", path, body });
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ method: "PATCH", path, body });
  }

  /**
   * Make a DELETE request
   */
  async delete(path: string, body?: unknown): Promise<void> {
    await this.request<void>({ method: "DELETE", path, body });
  }

  /**
   * Make a raw request (for custom operations like file uploads)
   */
  async rawRequest(
    url: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: Buffer | string;
      timeout?: number;
    }
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Paginate through all results
   */
  async *paginate<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    maxItems?: number
  ): AsyncGenerator<T, void, undefined> {
    let cursor: string | undefined;
    let itemsYielded = 0;

    do {
      const queryParams = { ...params };
      if (cursor) {
        // Extract cursor from next URL if it contains query params
        if (cursor.includes("?")) {
          try {
            // Try parsing as full URL first
            const url = new URL(cursor);
            for (const [key, value] of url.searchParams) {
              queryParams[key] = value;
            }
          } catch {
            // Fall back to parsing as relative URL
            const queryString = cursor.split("?")[1];
            if (queryString) {
              const searchParams = new URLSearchParams(queryString);
              for (const [key, value] of searchParams) {
                queryParams[key] = value;
              }
            }
          }
        }
      }

      const response = await this.get<ASCListResponse<T>>(path, queryParams);

      for (const item of response.data) {
        yield item;
        itemsYielded++;

        if (maxItems && itemsYielded >= maxItems) {
          return;
        }
      }

      cursor = response.links?.next;
    } while (cursor);
  }

  /**
   * Core request method with retry logic
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    await this.enforceRateLimit();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.executeRequest<T>(options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) except rate limits
        if (error instanceof ASCError && error.status >= 400 && error.status < 500) {
          if (error instanceof RateLimitError) {
            // Wait for rate limit to clear
            const waitMs = error.retryAfter * 1000;
            await this.sleep(waitMs);
            continue;
          }
          throw error;
        }

        // Exponential backoff for server errors
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY_MS * 2 ** attempt;
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error("Request failed after max retries");
  }

  /**
   * Execute a single HTTP request
   */
  private async executeRequest<T>(options: RequestOptions): Promise<T> {
    const token = await this.tokenManager.getToken();
    const url = this.buildUrl(options.path, options.params);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    // Only set Content-Type when there's a body
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting from API
      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10);
        throw new RateLimitError(retryAfter);
      }

      // Handle no content responses
      if (response.status === 204) {
        return undefined as T;
      }

      const body = await response.json();

      // Handle error responses
      if (!response.ok) {
        throw parseAPIError(response.status, body);
      }

      return body as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ASCError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new ASCError("Request timed out", "TIMEOUT", 408);
        }
        throw new ASCError(error.message, "NETWORK_ERROR", 0);
      }

      throw new ASCError("Unknown error occurred", "UNKNOWN", 0);
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path.startsWith("/") ? path.slice(1) : path, `${this.baseUrl}/`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Self-imposed rate limiting.
   * Records the request timestamp before checking to prevent off-by-one errors.
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Clean old timestamps
    this.rateLimiter.timestamps = this.rateLimiter.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    // Check if we're at the limit (check BEFORE adding this request)
    if (this.rateLimiter.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldestTimestamp = this.rateLimiter.timestamps[0];
      if (oldestTimestamp) {
        const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
        if (waitTime > 0) {
          await this.sleep(waitTime);
          // Clean timestamps again after waiting
          const newNow = Date.now();
          this.rateLimiter.timestamps = this.rateLimiter.timestamps.filter(
            (ts) => newNow - ts < RATE_LIMIT_WINDOW_MS
          );
        }
      }
    }

    // Record this request AFTER the rate limit check passes
    this.rateLimiter.timestamps.push(Date.now());
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create an App Store Connect client from a token manager
 */
export function createClient(tokenManager: TokenManager): AppStoreConnectClient {
  return new AppStoreConnectClient(tokenManager);
}
