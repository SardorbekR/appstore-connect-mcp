/**
 * Custom error classes for App Store Connect API
 */

/**
 * Returns fresh regex patterns for sanitizing sensitive data.
 * Creates new instances each call to avoid stateful regex issues with global flag.
 */
function getSensitivePatterns(): RegExp[] {
  return [
    /Bearer [A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, // JWT tokens
    /-----BEGIN.*?-----[\s\S]*?-----END.*?-----/g, // PEM keys
    /[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}/gi, // UUIDs (issuer IDs)
  ];
}

function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const pattern of getSensitivePatterns()) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

export interface ASCErrorDetails {
  id?: string;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
}

/**
 * Base error class for App Store Connect API errors
 */
export class ASCError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ASCErrorDetails[];

  constructor(message: string, code: string, status: number, details?: ASCErrorDetails[]) {
    super(sanitizeMessage(message));
    this.name = "ASCError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Authentication error (invalid credentials, expired token, etc.)
 */
export class AuthError extends ASCError {
  constructor(message: string, details?: ASCErrorDetails[]) {
    super(message, "AUTH_ERROR", 401, details);
    this.name = "AuthError";
  }
}

/**
 * Rate limit error with retry information
 */
export class RateLimitError extends ASCError {
  readonly retryAfter: number;

  constructor(retryAfter: number, details?: ASCErrorDetails[]) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, "RATE_LIMIT", 429, details);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        retryAfter: this.retryAfter,
      },
    };
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends ASCError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.field = field;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        field: this.field,
      },
    };
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ASCError {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} with ID '${resourceId}' not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

/**
 * Configuration error (missing environment variables, invalid config)
 */
export class ConfigError extends ASCError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", 500);
    this.name = "ConfigError";
  }
}

/**
 * Parse Apple API error response into ASCError
 */
export function parseAPIError(status: number, body: unknown): ASCError {
  const errors = (body as { errors?: ASCErrorDetails[] })?.errors;

  if (status === 401) {
    return new AuthError("Authentication failed", errors);
  }

  if (status === 429) {
    return new RateLimitError(60, errors); // Default to 60s if not specified
  }

  if (status === 404) {
    const detail = errors?.[0]?.detail ?? "Resource not found";
    return new ASCError(detail, "NOT_FOUND", 404, errors);
  }

  if (status === 403) {
    return new ASCError(
      "Access forbidden. Check your API key permissions.",
      "FORBIDDEN",
      403,
      errors
    );
  }

  if (status === 409) {
    const detail = errors?.[0]?.detail ?? "Conflict with current state";
    return new ASCError(detail, "CONFLICT", 409, errors);
  }

  // Generic error
  const message = errors?.[0]?.detail ?? `API request failed with status ${status}`;
  return new ASCError(message, "API_ERROR", status, errors);
}

/**
 * Format error for MCP tool response
 */
export function formatErrorResponse(error: unknown): {
  success: false;
  error: { code: string; message: string; details?: unknown };
} {
  if (error instanceof ASCError) {
    return error.toJSON() as {
      success: false;
      error: { code: string; message: string; details?: unknown };
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: sanitizeMessage(error.message),
      },
    };
  }

  return {
    success: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
    },
  };
}
