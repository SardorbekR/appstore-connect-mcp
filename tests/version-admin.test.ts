/**
 * Tests for version admin tools (update/delete version, build attach, App Review details)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createReviewDetail,
  deleteAppVersion,
  getAppVersionBuild,
  getReviewDetail,
  setAppVersionBuild,
  updateAppVersion,
  updateReviewDetail,
} from "../src/tools/version-admin.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const version = {
  type: "appStoreVersions",
  id: "v1",
  attributes: { platform: "MAC_OS", versionString: "2.1.0", copyright: "2026 Me" },
};

const reviewDetail = {
  type: "appStoreReviewDetails",
  id: "rd1",
  attributes: {
    contactFirstName: "Ada",
    contactPhone: "+1 408 555 0100",
    demoAccountName: "demo",
    demoAccountPassword: "s3cret-demo",
    demoAccountRequired: true,
    notes: "Tap Sign In",
  },
};

describe("version admin tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("update_app_version", () => {
    it("patches only the provided fields", async () => {
      client.patch.mockResolvedValueOnce({ data: version });

      const result = await updateAppVersion(asClient(client), {
        versionId: "v1",
        copyright: "2026 Me",
        versionString: "2.1.0",
      });

      expect(client.patch).toHaveBeenCalledWith("/appStoreVersions/v1", {
        data: {
          type: "appStoreVersions",
          id: "v1",
          attributes: { versionString: "2.1.0", copyright: "2026 Me" },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "v1", copyright: "2026 Me" } });
      expectContract(client);
    });

    it("refuses an update with no fields", async () => {
      const result = await updateAppVersion(asClient(client), { versionId: "v1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("delete_app_version", () => {
    it("deletes the version", async () => {
      client.delete.mockResolvedValueOnce(undefined);
      const result = await deleteAppVersion(asClient(client), { versionId: "v1" });
      expect(client.delete).toHaveBeenCalledWith("/appStoreVersions/v1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });

    it("rejects an ID that could change the request path", async () => {
      const result = await deleteAppVersion(asClient(client), { versionId: "../apps/1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.delete).not.toHaveBeenCalled();
    });
  });

  describe("get_app_version_build", () => {
    it("returns null when no build is attached", async () => {
      client.get.mockResolvedValueOnce({ data: null });
      const result = await getAppVersionBuild(asClient(client), { versionId: "v1" });
      expect(client.get.mock.calls[0]?.[0]).toBe("/appStoreVersions/v1/build");
      expect(result).toEqual({ success: true, data: null });
      expectContract(client);
    });
  });

  describe("set_app_version_build", () => {
    it("attaches a VALID build through the relationship endpoint", async () => {
      client.get.mockResolvedValueOnce({
        data: { type: "builds", id: "b1", attributes: { version: "42", processingState: "VALID" } },
      });
      client.patch.mockResolvedValueOnce(undefined);

      const result = await setAppVersionBuild(asClient(client), { versionId: "v1", buildId: "b1" });

      expect(client.patch).toHaveBeenCalledWith("/appStoreVersions/v1/relationships/build", {
        data: { type: "builds", id: "b1" },
      });
      expect(result).toMatchObject({ success: true, data: { build: { id: "b1", version: "42" } } });
      expectContract(client);
    });

    it("refuses a build that is still processing", async () => {
      client.get.mockResolvedValueOnce({
        data: { type: "builds", id: "b1", attributes: { processingState: "PROCESSING" } },
      });

      const result = await setAppVersionBuild(asClient(client), { versionId: "v1", buildId: "b1" });

      expect(result).toMatchObject({ success: false, error: { code: "BUILD_NOT_VALID" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("review details", () => {
    it("reads review details without returning the demo password", async () => {
      client.get.mockResolvedValueOnce({ data: reviewDetail });

      const result = await getReviewDetail(asClient(client), { versionId: "v1" });

      expect(client.get.mock.calls[0]?.[0]).toBe("/appStoreVersions/v1/appStoreReviewDetail");
      expect(result).toMatchObject({
        success: true,
        data: { id: "rd1", demoAccountPasswordSet: true },
      });
      expect(JSON.stringify(result)).not.toContain("s3cret-demo");
      expectContract(client);
    });

    it("creates review details linked to the version", async () => {
      client.post.mockResolvedValueOnce({ data: reviewDetail });

      await createReviewDetail(asClient(client), {
        versionId: "v1",
        contactFirstName: "Ada",
        contactPhone: "+1 408 555 0100",
        notes: "Tap Sign In",
      });

      expect(client.post).toHaveBeenCalledWith("/appStoreReviewDetails", {
        data: {
          type: "appStoreReviewDetails",
          attributes: {
            contactFirstName: "Ada",
            contactPhone: "+1 408 555 0100",
            notes: "Tap Sign In",
          },
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: "v1" } } },
        },
      });
      expectContract(client);
    });

    it("validates phone format and demo account requirements before calling the API", async () => {
      const badPhone = await createReviewDetail(asClient(client), {
        versionId: "v1",
        contactFirstName: "Ada",
        contactPhone: "408 555 0100",
      });
      expect(badPhone).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });

      const missingDemo = await createReviewDetail(asClient(client), {
        versionId: "v1",
        contactFirstName: "Ada",
        contactPhone: "+14085550100",
        demoAccountRequired: true,
      });
      expect(missingDemo).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });

    it("updates only the provided fields", async () => {
      client.patch.mockResolvedValueOnce({ data: reviewDetail });

      await updateReviewDetail(asClient(client), { reviewDetailId: "rd1", notes: "New notes" });

      expect(client.patch).toHaveBeenCalledWith("/appStoreReviewDetails/rd1", {
        data: { type: "appStoreReviewDetails", id: "rd1", attributes: { notes: "New notes" } },
      });
      expectContract(client);
    });

    it("clears a field with null and flips demoAccountRequired without resending credentials", async () => {
      client.patch.mockResolvedValueOnce({ data: reviewDetail });

      const result = await updateReviewDetail(asClient(client), {
        reviewDetailId: "rd1",
        notes: null,
        demoAccountRequired: true,
      });

      expect(result).toMatchObject({ success: true });
      expect(client.patch).toHaveBeenCalledWith("/appStoreReviewDetails/rd1", {
        data: {
          type: "appStoreReviewDetails",
          id: "rd1",
          attributes: { demoAccountRequired: true, notes: null },
        },
      });
      expectContract(client);
    });

    it("never puts the demo password in an error", async () => {
      const { ASCError } = await import("../src/utils/errors.js");
      client.patch.mockRejectedValueOnce(
        new ASCError("Invalid demoAccountPassword 'hunter2-x'", "API_ERROR", 409, [
          { detail: "hunter2-x is too weak" },
        ])
      );

      const result = await updateReviewDetail(asClient(client), {
        reviewDetailId: "rd1",
        demoAccountPassword: "hunter2-x",
      });

      expect(result).toMatchObject({ success: false });
      expect(JSON.stringify(result)).not.toContain("hunter2-x");
    });
  });
});
