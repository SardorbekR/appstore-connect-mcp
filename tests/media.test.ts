/**
 * Tests for media tools (screenshot and app preview sets, ordering, uploads, App Review screenshots)
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createPreviewSet,
  createScreenshotSet,
  deleteAppPreview,
  deletePreviewSet,
  deleteScreenshot,
  deleteScreenshotSet,
  listPreviewSets,
  listPreviews,
  mediaToolsModule,
  reorderPreviews,
  reorderScreenshots,
  uploadAppPreview,
  uploadIapReviewScreenshot,
  uploadSubscriptionReviewScreenshot,
} from "../src/tools/media.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  rawRequest: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const FILE_BYTES = Buffer.from("0123456789abcdefghij"); // 20 bytes, uploaded in one chunk

/** The reserve response that starts an upload, with one PUT operation for the whole file. */
const reservedAsset = (type: string, id: string) => ({
  data: {
    type,
    id,
    attributes: {
      uploadOperations: [
        { method: "PUT", url: `https://upload/${id}`, offset: 0, length: 20, requestHeaders: [] },
      ],
    },
  },
});

/** The commit response that finishes an upload. */
const committedAsset = (type: string, id: string) => ({
  data: { type, id, attributes: { assetDeliveryState: { state: "UPLOAD_COMPLETE" } } },
});

const previewList = (count: number) => ({
  data: Array.from({ length: count }, (_, index) => ({
    type: "appPreviews",
    id: `p${index + 1}`,
    attributes: {},
  })),
});

describe("media tools", () => {
  let client: MockClient;
  let dir = "";

  const file = (name: string) => join(dir, name);

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "asc-media-"));
    await Promise.all(
      ["preview.mov", "preview.m4v", "preview.mp4", "review.png"].map((name) =>
        writeFile(join(dir, name), FILE_BYTES)
      )
    );
  });

  beforeEach(() => {
    client = createMockClient();
    client.rawRequest.mockResolvedValue({ ok: true, status: 200 });
  });

  describe("create_screenshot_set", () => {
    it("creates a screenshot set in the version localization", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "appScreenshotSets",
          id: "ss1",
          attributes: { screenshotDisplayType: "APP_DESKTOP" },
        },
      });

      const result = await createScreenshotSet(asClient(client), {
        localizationId: "loc1",
        screenshotDisplayType: "APP_DESKTOP",
      });

      expect(client.post).toHaveBeenCalledWith("/appScreenshotSets", {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: "APP_DESKTOP" },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: "loc1" },
            },
          },
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { id: "ss1", screenshotDisplayType: "APP_DESKTOP" },
      });
      expectContract(client);
    });
  });

  describe("reorder_screenshots", () => {
    const members = {
      data: [
        { type: "appScreenshots", id: "sc1" },
        { type: "appScreenshots", id: "sc2" },
        { type: "appScreenshots", id: "sc3" },
      ],
    };

    it("sends the full new order after reading the current members", async () => {
      client.get.mockResolvedValueOnce(members);
      client.patch.mockResolvedValueOnce(undefined);

      const result = await reorderScreenshots(asClient(client), {
        screenshotSetId: "ss1",
        screenshotIds: ["sc3", "sc1", "sc2"],
      });

      expect(client.get).toHaveBeenCalledWith(
        "/appScreenshotSets/ss1/relationships/appScreenshots",
        { limit: 200 }
      );
      expect(client.patch).toHaveBeenCalledWith(
        "/appScreenshotSets/ss1/relationships/appScreenshots",
        {
          data: [
            { type: "appScreenshots", id: "sc3" },
            { type: "appScreenshots", id: "sc1" },
            { type: "appScreenshots", id: "sc2" },
          ],
        }
      );
      expect(result).toMatchObject({ success: true });
      expectContract(client);
    });

    it.each([
      { label: "omits a member", screenshotIds: ["sc3", "sc1"] },
      { label: "repeats a member in place of another", screenshotIds: ["sc1", "sc1", "sc2"] },
      { label: "adds an ID that is not in the set", screenshotIds: ["sc1", "sc2", "sc3", "sc9"] },
    ])("refuses an order that $label", async ({ screenshotIds }) => {
      client.get.mockResolvedValueOnce(members);

      const result = await reorderScreenshots(asClient(client), {
        screenshotSetId: "ss1",
        screenshotIds,
      });

      expect(result).toMatchObject({ success: false, error: { code: "ORDER_MISMATCH" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("delete tools", () => {
    it.each([
      {
        tool: "delete_screenshot_set",
        run: deleteScreenshotSet,
        input: { screenshotSetId: "ss1" },
        path: "/appScreenshotSets/ss1",
      },
      {
        tool: "delete_screenshot",
        run: deleteScreenshot,
        input: { screenshotId: "sc1" },
        path: "/appScreenshots/sc1",
      },
      {
        tool: "delete_preview_set",
        run: deletePreviewSet,
        input: { previewSetId: "ps1" },
        path: "/appPreviewSets/ps1",
      },
      {
        tool: "delete_app_preview",
        run: deleteAppPreview,
        input: { previewId: "p1" },
        path: "/appPreviews/p1",
      },
    ])("$tool deletes the resource by ID", async ({ run, input, path }) => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await run(asClient(client), input);

      expect(client.delete).toHaveBeenCalledWith(path);
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });

    it("marks every delete tool destructive", () => {
      const deletes = mediaToolsModule.definitions.filter((definition) =>
        definition.name.startsWith("delete_")
      );

      expect(deletes).toHaveLength(4);
      for (const definition of deletes) {
        expect(definition.annotations?.destructiveHint).toBe(true);
      }
    });
  });

  describe("list_preview_sets", () => {
    it("lists preview sets for the version localization", async () => {
      client.get.mockResolvedValueOnce({
        data: [{ type: "appPreviewSets", id: "ps1", attributes: { previewType: "IPHONE_67" } }],
        meta: { paging: { total: 1, limit: 10 } },
      });

      const result = await listPreviewSets(asClient(client), {
        localizationId: "loc1",
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith("/appStoreVersionLocalizations/loc1/appPreviewSets", {
        limit: 10,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "ps1", previewType: "IPHONE_67" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("create_preview_set", () => {
    it("creates a preview set in the version localization", async () => {
      client.post.mockResolvedValueOnce({
        data: { type: "appPreviewSets", id: "ps1", attributes: { previewType: "DESKTOP" } },
      });

      const result = await createPreviewSet(asClient(client), {
        localizationId: "loc1",
        previewType: "DESKTOP",
      });

      expect(client.post).toHaveBeenCalledWith("/appPreviewSets", {
        data: {
          type: "appPreviewSets",
          attributes: { previewType: "DESKTOP" },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: "appStoreVersionLocalizations", id: "loc1" },
            },
          },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "ps1", previewType: "DESKTOP" } });
      expectContract(client);
    });
  });

  describe("list_previews", () => {
    it("lists the previews in a preview set", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            type: "appPreviews",
            id: "p1",
            attributes: {
              fileName: "demo.mov",
              fileSize: 20,
              mimeType: "video/quicktime",
              assetDeliveryState: { state: "COMPLETE" },
            },
          },
        ],
      });

      const result = await listPreviews(asClient(client), { previewSetId: "ps1", limit: 5 });

      expect(client.get).toHaveBeenCalledWith("/appPreviewSets/ps1/appPreviews", { limit: 5 });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "p1", fileName: "demo.mov", deliveryState: "COMPLETE" }],
      });
      expectContract(client);
    });
  });

  describe("reorder_previews", () => {
    const members = {
      data: [
        { type: "appPreviews", id: "p1" },
        { type: "appPreviews", id: "p2" },
      ],
    };

    it("sends the full new order of previews", async () => {
      client.get.mockResolvedValueOnce(members);
      client.patch.mockResolvedValueOnce(undefined);

      await reorderPreviews(asClient(client), { previewSetId: "ps1", previewIds: ["p2", "p1"] });

      expect(client.get).toHaveBeenCalledWith("/appPreviewSets/ps1/relationships/appPreviews", {
        limit: 200,
      });
      expect(client.patch).toHaveBeenCalledWith("/appPreviewSets/ps1/relationships/appPreviews", {
        data: [
          { type: "appPreviews", id: "p2" },
          { type: "appPreviews", id: "p1" },
        ],
      });
      expectContract(client);
    });

    it("refuses an order that leaves out a preview", async () => {
      client.get.mockResolvedValueOnce(members);

      const result = await reorderPreviews(asClient(client), {
        previewSetId: "ps1",
        previewIds: ["p1"],
      });

      expect(result).toMatchObject({ success: false, error: { code: "ORDER_MISMATCH" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("upload_app_preview", () => {
    beforeEach(() => {
      client.get.mockResolvedValue(previewList(0));
    });

    it("reserves, uploads, and commits a .mov with its MIME type and poster frame", async () => {
      client.post.mockResolvedValueOnce(reservedAsset("appPreviews", "p1"));
      client.patch.mockResolvedValueOnce(committedAsset("appPreviews", "p1"));

      const result = await uploadAppPreview(asClient(client), {
        previewSetId: "ps1",
        filePath: file("preview.mov"),
        previewFrameTimeCode: "00:00:05:00",
      });

      expect(client.get).toHaveBeenCalledWith("/appPreviewSets/ps1/appPreviews", { limit: 200 });
      expect(client.post).toHaveBeenCalledWith("/appPreviews", {
        data: {
          type: "appPreviews",
          attributes: {
            fileName: "preview.mov",
            fileSize: 20,
            mimeType: "video/quicktime",
            previewFrameTimeCode: "00:00:05:00",
          },
          relationships: { appPreviewSet: { data: { type: "appPreviewSets", id: "ps1" } } },
        },
      });
      expect(client.patch).toHaveBeenCalledWith("/appPreviews/p1", {
        data: {
          type: "appPreviews",
          id: "p1",
          attributes: expect.objectContaining({ uploaded: true }),
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { previewSetId: "ps1", id: "p1", deliveryState: "UPLOAD_COMPLETE" },
      });
      expectContract(client);
    });

    it.each([
      { name: "preview.mov", mimeType: "video/quicktime" },
      { name: "preview.m4v", mimeType: "video/x-m4v" },
      { name: "preview.mp4", mimeType: "video/mp4" },
    ])("sends $mimeType for $name", async ({ name, mimeType }) => {
      client.post.mockResolvedValueOnce(reservedAsset("appPreviews", "p1"));
      client.patch.mockResolvedValueOnce(committedAsset("appPreviews", "p1"));

      const result = await uploadAppPreview(asClient(client), {
        previewSetId: "ps1",
        filePath: file(name),
      });

      expect(result).toMatchObject({ success: true });
      expect(client.post.mock.calls[0]?.[1]).toMatchObject({
        data: { attributes: { mimeType } },
      });
    });

    it.each([{ name: "preview.avi" }, { name: "preview.constructor" }])(
      "refuses $name before calling the API",
      async ({ name }) => {
        const result = await uploadAppPreview(asClient(client), {
          previewSetId: "ps1",
          filePath: file(name),
        });

        expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
        expect(client.get).not.toHaveBeenCalled();
        expect(client.post).not.toHaveBeenCalled();
      }
    );

    it("refuses an upload when the set already holds 3 previews", async () => {
      client.get.mockResolvedValueOnce(previewList(3));

      const result = await uploadAppPreview(asClient(client), {
        previewSetId: "ps1",
        filePath: file("preview.mp4"),
      });

      expect(result).toMatchObject({ success: false, error: { code: "PREVIEW_SET_FULL" } });
      expect(client.post).not.toHaveBeenCalled();
    });
  });

  describe("upload_subscription_review_screenshot", () => {
    it("uploads the review screenshot under the subscription", async () => {
      client.post.mockResolvedValueOnce(
        reservedAsset("subscriptionAppStoreReviewScreenshots", "rs1")
      );
      client.patch.mockResolvedValueOnce(
        committedAsset("subscriptionAppStoreReviewScreenshots", "rs1")
      );

      const result = await uploadSubscriptionReviewScreenshot(asClient(client), {
        subscriptionId: "sub1",
        filePath: file("review.png"),
      });

      expect(client.post).toHaveBeenCalledWith("/subscriptionAppStoreReviewScreenshots", {
        data: {
          type: "subscriptionAppStoreReviewScreenshots",
          attributes: { fileName: "review.png", fileSize: 20 },
          relationships: { subscription: { data: { type: "subscriptions", id: "sub1" } } },
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { subscriptionId: "sub1", id: "rs1" },
      });
      expectContract(client);
    });
  });

  describe("upload_iap_review_screenshot", () => {
    it("uploads the review screenshot under the in-app purchase", async () => {
      client.post.mockResolvedValueOnce(
        reservedAsset("inAppPurchaseAppStoreReviewScreenshots", "rs2")
      );
      client.patch.mockResolvedValueOnce(
        committedAsset("inAppPurchaseAppStoreReviewScreenshots", "rs2")
      );

      const result = await uploadIapReviewScreenshot(asClient(client), {
        inAppPurchaseId: "iap1",
        filePath: file("review.png"),
      });

      expect(client.post).toHaveBeenCalledWith("/inAppPurchaseAppStoreReviewScreenshots", {
        data: {
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: { fileName: "review.png", fileSize: 20 },
          relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: "iap1" } } },
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { inAppPurchaseId: "iap1", id: "rs2" },
      });
      expectContract(client);
    });
  });
});
