/**
 * Shared asset upload flow: reserve -> chunk PUTs -> commit -> optional processing poll.
 */

import * as crypto from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { uploadAsset } from "../src/api/upload.js";

const FILE_BYTES = Buffer.from("0123456789abcdefghij"); // 20 bytes, uploaded in two 10-byte chunks
let filePath: string;

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  rawRequest: vi.fn(),
});

const reserved = {
  data: {
    type: "appPreviews",
    id: "asset-1",
    attributes: {
      uploadOperations: [
        {
          method: "PUT",
          url: "https://upload/1",
          offset: 0,
          length: 10,
          requestHeaders: [{ name: "Content-Type", value: "video/mp4" }],
        },
        { method: "PUT", url: "https://upload/2", offset: 10, length: 10, requestHeaders: [] },
      ],
    },
  },
};

function state(value: string, errors?: Array<{ description: string }>) {
  return {
    data: {
      type: "appPreviews",
      id: "asset-1",
      attributes: { assetDeliveryState: { state: value, errors } },
    },
  };
}

const options = () => ({
  resourceType: "appPreviews",
  collectionPath: "/appPreviews",
  parent: { name: "appPreviewSet", type: "appPreviewSets", id: "set-1" },
  filePath,
  extraAttributes: { mimeType: "video/mp4" },
});

describe("uploadAsset", () => {
  let client: ReturnType<typeof createMockClient>;

  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), "asc-upload-"));
    filePath = join(dir, "preview.mp4");
    await writeFile(filePath, FILE_BYTES);
  });

  beforeEach(() => {
    client = createMockClient();
    client.post.mockResolvedValue(reserved);
    client.rawRequest.mockResolvedValue({ ok: true, status: 200 });
    client.patch.mockResolvedValue(state("UPLOAD_COMPLETE"));
  });

  it("reserves, uploads each chunk, and commits with a hex MD5 checksum", async () => {
    await uploadAsset(client as unknown as AppStoreConnectClient, options());

    expect(client.post).toHaveBeenCalledWith("/appPreviews", {
      data: {
        type: "appPreviews",
        attributes: { fileName: "preview.mp4", fileSize: 20, mimeType: "video/mp4" },
        relationships: { appPreviewSet: { data: { type: "appPreviewSets", id: "set-1" } } },
      },
    });
    expect(client.rawRequest).toHaveBeenCalledTimes(2);
    expect(client.rawRequest.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: FILE_BYTES.subarray(0, 10),
    });
    expect(client.rawRequest.mock.calls[1]?.[1]).toMatchObject({
      body: FILE_BYTES.subarray(10, 20),
    });
    expect(client.patch).toHaveBeenCalledWith("/appPreviews/asset-1", {
      data: {
        type: "appPreviews",
        id: "asset-1",
        attributes: {
          sourceFileChecksum: crypto.createHash("md5").update(FILE_BYTES).digest("hex"),
          uploaded: true,
        },
      },
    });
  });

  it("stops with UPLOAD_ERROR when a chunk upload fails and deletes the reserved asset", async () => {
    client.rawRequest.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(
      uploadAsset(client as unknown as AppStoreConnectClient, options())
    ).rejects.toMatchObject({
      code: "UPLOAD_ERROR",
    });
    expect(client.patch).not.toHaveBeenCalled();
    expect(client.delete).toHaveBeenCalledWith("/appPreviews/asset-1");
  });

  it("deletes the reserved asset when the commit fails, and says so if that cleanup fails", async () => {
    const { ASCError } = await import("../src/utils/errors.js");
    client.patch.mockRejectedValueOnce(new ASCError("Checksum mismatch", "CONFLICT", 409));
    client.delete.mockRejectedValueOnce(new Error("network down"));

    const failure = uploadAsset(client as unknown as AppStoreConnectClient, options());

    await expect(failure).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("asset-1 could not be deleted"),
    });
    expect(client.delete).toHaveBeenCalledWith("/appPreviews/asset-1");
  });

  it("refuses a file whose size differs from the expected size", async () => {
    await expect(
      uploadAsset(client as unknown as AppStoreConnectClient, {
        ...options(),
        expectedFileSize: 21,
      })
    ).rejects.toMatchObject({ code: "FILE_SIZE_MISMATCH" });
    expect(client.post).not.toHaveBeenCalled();
  });

  it("reads videoDeliveryState for app previews, whose assetDeliveryState stays at UPLOAD_COMPLETE", async () => {
    const preview = (video: string, errors?: Array<{ description: string }>) => ({
      data: {
        type: "appPreviews",
        id: "asset-1",
        attributes: {
          assetDeliveryState: { state: "UPLOAD_COMPLETE" },
          videoDeliveryState: { state: video, errors },
        },
      },
    });
    const wait = { ...options(), waitForProcessing: true, pollIntervalMs: 1, pollTimeoutMs: 50 };

    client.get.mockResolvedValueOnce(preview("COMPLETE"));
    await expect(
      uploadAsset(client as unknown as AppStoreConnectClient, wait)
    ).resolves.toMatchObject({
      id: "asset-1",
    });

    client.get.mockResolvedValueOnce(
      preview("FAILED", [{ description: "Unsupported frame rate" }])
    );
    await expect(
      uploadAsset(client as unknown as AppStoreConnectClient, wait)
    ).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      message: expect.stringContaining("Unsupported frame rate"),
    });
  });

  it("polls until COMPLETE when asked to wait", async () => {
    client.get
      .mockResolvedValueOnce(state("UPLOAD_COMPLETE"))
      .mockResolvedValueOnce(state("COMPLETE"));
    const asset = await uploadAsset(client as unknown as AppStoreConnectClient, {
      ...options(),
      waitForProcessing: true,
      pollIntervalMs: 1,
    });
    expect(asset.attributes.assetDeliveryState?.state).toBe("COMPLETE");
    expect(client.get).toHaveBeenCalledWith("/appPreviews/asset-1");
  });

  it("fails with UPLOAD_FAILED and Apple's reasons when processing fails", async () => {
    client.get.mockResolvedValueOnce(
      state("FAILED", [{ description: "Invalid video dimensions" }])
    );
    await expect(
      uploadAsset(client as unknown as AppStoreConnectClient, {
        ...options(),
        waitForProcessing: true,
        pollIntervalMs: 1,
      })
    ).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      message: expect.stringContaining("Invalid video dimensions"),
    });
  });

  it("gives up with UPLOAD_TIMEOUT when processing never finishes", async () => {
    client.get.mockResolvedValue(state("UPLOAD_COMPLETE"));
    await expect(
      uploadAsset(client as unknown as AppStoreConnectClient, {
        ...options(),
        waitForProcessing: true,
        pollIntervalMs: 5,
        pollTimeoutMs: 20,
      })
    ).rejects.toMatchObject({ code: "UPLOAD_TIMEOUT" });
  });
});
