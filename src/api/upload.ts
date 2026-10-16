/**
 * Asset upload flow shared by every App Store Connect asset type
 * (screenshots, app previews, review screenshots, ...):
 *
 * 1. Reserve: POST the asset with fileName/fileSize and its parent relationship
 * 2. Upload: PUT each file chunk to the URLs in `uploadOperations`
 * 3. Commit: PATCH `uploaded: true` with the file's MD5 `sourceFileChecksum` (hex)
 * 4. Optionally poll until `assetDeliveryState.state` is COMPLETE or FAILED
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ASCError } from "../utils/errors.js";
import type { AppStoreConnectClient } from "./client.js";
import type { ASCResponse, UploadOperation } from "./types.js";

export interface AssetDeliveryState {
  state: string;
  errors?: Array<{ code?: string; description?: string }>;
  warnings?: Array<{ code?: string; description?: string }>;
}

export interface UploadedAssetAttributes {
  fileName?: string;
  fileSize?: number;
  sourceFileChecksum?: string;
  uploadOperations?: UploadOperation[] | null;
  assetDeliveryState?: AssetDeliveryState | null;
  [key: string]: unknown;
}

export interface UploadedAsset {
  type: string;
  id: string;
  attributes: UploadedAssetAttributes;
}

export interface UploadAssetOptions {
  /** JSON:API resource type, e.g. "appScreenshots" */
  resourceType: string;
  /** Collection path for reserve, e.g. "/appScreenshots"; commit/poll use `${path}/${id}` */
  collectionPath: string;
  /** Parent relationship, e.g. { name: "appScreenshotSet", type: "appScreenshotSets", id } */
  parent: { name: string; type: string; id: string };
  filePath: string;
  /** Defaults to the file's basename */
  fileName?: string;
  /** When given, the upload is refused if the file on disk has a different size */
  expectedFileSize?: number;
  /** Additional reserve attributes, e.g. { mimeType: "video/mp4" } for app previews */
  extraAttributes?: Record<string, unknown>;
  /** Poll until processing finishes. Default false. */
  waitForProcessing?: boolean;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export const DEFAULT_POLL_INTERVAL_MS = 2_000;
export const DEFAULT_POLL_TIMEOUT_MS = 10 * 60_000;

/**
 * MD5 of the file as lowercase hex, the format App Store Connect returns in sourceFileChecksum.
 */
export function md5Hex(buffer: Buffer): string {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

async function readUploadFile(filePath: string, expectedFileSize?: number): Promise<Buffer> {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    throw new ASCError(`Failed to read file: ${filePath}`, "FILE_READ_ERROR", 400);
  }
  if (expectedFileSize !== undefined && buffer.length !== expectedFileSize) {
    throw new ASCError(
      `File size mismatch: expected ${expectedFileSize}, got ${buffer.length}`,
      "FILE_SIZE_MISMATCH",
      400
    );
  }
  return buffer;
}

async function uploadChunks(
  client: AppStoreConnectClient,
  operations: UploadOperation[],
  buffer: Buffer
): Promise<void> {
  for (const operation of operations) {
    const chunk = buffer.subarray(operation.offset, operation.offset + operation.length);
    const headers: Record<string, string> = {};
    for (const header of operation.requestHeaders ?? []) {
      headers[header.name] = header.value;
    }

    const response = await client.rawRequest(operation.url, {
      method: operation.method,
      headers,
      body: chunk,
    });
    if (!response.ok) {
      throw new ASCError(
        `Chunk upload failed: ${response.status}`,
        "UPLOAD_ERROR",
        response.status
      );
    }
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll an uploaded asset until App Store Connect finishes processing it.
 * Throws UPLOAD_FAILED when processing fails and UPLOAD_TIMEOUT when it takes too long.
 */
export async function waitForAssetProcessing(
  client: AppStoreConnectClient,
  resourcePath: string,
  options: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<UploadedAsset> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const response = await client.get<ASCResponse<UploadedAsset>>(resourcePath);
    const asset = response.data;
    const state = asset.attributes.assetDeliveryState;

    if (state?.state === "COMPLETE") return asset;
    if (state?.state === "FAILED") {
      const reasons = (state.errors ?? [])
        .map((error) => error.description ?? error.code)
        .filter(Boolean)
        .join("; ");
      throw new ASCError(
        `Asset ${asset.id} failed processing${reasons ? `: ${reasons}` : ""}`,
        "UPLOAD_FAILED",
        422
      );
    }
    if (Date.now() + intervalMs > deadline) {
      throw new ASCError(
        `Asset ${asset.id} is still ${state?.state ?? "processing"} after ${Math.round(timeoutMs / 1000)}s; check it again later`,
        "UPLOAD_TIMEOUT",
        408
      );
    }
    await sleep(intervalMs);
  }
}

/**
 * Reserve, upload, and commit an asset. Returns the committed (or fully processed) asset.
 */
export async function uploadAsset(
  client: AppStoreConnectClient,
  options: UploadAssetOptions
): Promise<UploadedAsset> {
  const buffer = await readUploadFile(options.filePath, options.expectedFileSize);
  const fileName = options.fileName ?? path.basename(options.filePath);

  const reserved = await client.post<ASCResponse<UploadedAsset>>(options.collectionPath, {
    data: {
      type: options.resourceType,
      attributes: {
        fileName,
        fileSize: buffer.length,
        ...options.extraAttributes,
      },
      relationships: {
        [options.parent.name]: {
          data: { type: options.parent.type, id: options.parent.id },
        },
      },
    },
  });

  const asset = reserved.data;
  const operations = asset.attributes.uploadOperations;
  if (!operations?.length) {
    throw new ASCError("No upload operations provided", "UPLOAD_ERROR", 500);
  }

  await uploadChunks(client, operations, buffer);

  const resourcePath = `${options.collectionPath}/${asset.id}`;
  const committed = await client.patch<ASCResponse<UploadedAsset>>(resourcePath, {
    data: {
      type: options.resourceType,
      id: asset.id,
      attributes: {
        sourceFileChecksum: md5Hex(buffer),
        uploaded: true,
      },
    },
  });

  if (!options.waitForProcessing) return committed.data;
  return waitForAssetProcessing(client, resourcePath, {
    intervalMs: options.pollIntervalMs,
    timeoutMs: options.pollTimeoutMs,
  });
}
