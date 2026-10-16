/**
 * Tests for TestFlight builds tools (What to Test notes, beta app details, beta App Review,
 * build beta settings, pre-release versions)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createBetaAppLocalization,
  createBetaBuildLocalization,
  deleteBetaAppLocalization,
  deleteBetaBuildLocalization,
  getBetaAppReviewDetail,
  getBuildBetaDetail,
  listBetaAppLocalizations,
  listBetaBuildLocalizations,
  listBetaReviewSubmissions,
  listPreReleaseVersions,
  submitBuildForBetaReview,
  updateBetaAppLocalization,
  updateBetaAppReviewDetail,
  updateBetaBuildLocalization,
  updateBuildBetaDetail,
} from "../src/tools/testflight-builds.tools.js";
import { ASCError } from "../src/utils/errors.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const reviewDetail = {
  type: "betaAppReviewDetails",
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

describe("testflight builds tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("What to Test notes", () => {
    it("lists build localizations with the requested limit", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            type: "betaBuildLocalizations",
            id: "l1",
            attributes: { locale: "en-US", whatsNew: "Try sync" },
          },
        ],
        links: {},
        meta: { paging: { total: 1 } },
      });

      const result = await listBetaBuildLocalizations(asClient(client), {
        buildId: "b1",
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith("/builds/b1/betaBuildLocalizations", {
        "fields[betaBuildLocalizations]": "whatsNew,locale",
        limit: 10,
      });
      expect(result).toEqual({
        success: true,
        data: [{ id: "l1", locale: "en-US", whatsNew: "Try sync" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });

    it("creates a build localization linked to the build", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "betaBuildLocalizations",
          id: "l1",
          attributes: { locale: "en-US", whatsNew: "Try sync" },
        },
      });

      await createBetaBuildLocalization(asClient(client), {
        buildId: "b1",
        locale: "en-US",
        whatsNew: "Try sync",
      });

      expect(client.post).toHaveBeenCalledWith("/betaBuildLocalizations", {
        data: {
          type: "betaBuildLocalizations",
          attributes: { locale: "en-US", whatsNew: "Try sync" },
          relationships: { build: { data: { type: "builds", id: "b1" } } },
        },
      });
      expectContract(client);
    });

    it("updates the What to Test text", async () => {
      client.patch.mockResolvedValueOnce({
        data: {
          type: "betaBuildLocalizations",
          id: "l1",
          attributes: { locale: "en-US", whatsNew: "Fixed login" },
        },
      });

      await updateBetaBuildLocalization(asClient(client), {
        localizationId: "l1",
        whatsNew: "Fixed login",
      });

      expect(client.patch).toHaveBeenCalledWith("/betaBuildLocalizations/l1", {
        data: {
          type: "betaBuildLocalizations",
          id: "l1",
          attributes: { whatsNew: "Fixed login" },
        },
      });
      expectContract(client);
    });

    it("deletes a build localization", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteBetaBuildLocalization(asClient(client), {
        localizationId: "l1",
      });

      expect(client.delete).toHaveBeenCalledWith("/betaBuildLocalizations/l1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });
  });

  describe("TestFlight app details", () => {
    it("lists app localizations with the requested limit", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            type: "betaAppLocalizations",
            id: "al1",
            attributes: { locale: "de-DE", description: "Beta for testers" },
          },
        ],
        links: {},
        meta: { paging: { total: 1 } },
      });

      const result = await listBetaAppLocalizations(asClient(client), { appId: "1", limit: 5 });

      expect(client.get).toHaveBeenCalledWith("/apps/1/betaAppLocalizations", {
        "fields[betaAppLocalizations]":
          "feedbackEmail,marketingUrl,privacyPolicyUrl,tvOsPrivacyPolicy,description,locale",
        limit: 5,
      });
      expect(result).toMatchObject({ success: true, meta: { total: 1, returned: 1 } });
      expectContract(client);
    });

    it("creates app details linked to the app", async () => {
      client.post.mockResolvedValueOnce({
        data: { type: "betaAppLocalizations", id: "al1", attributes: { locale: "de-DE" } },
      });

      await createBetaAppLocalization(asClient(client), {
        appId: "1",
        locale: "de-DE",
        description: "Beta für Tester",
        feedbackEmail: "qa@example.com",
      });

      expect(client.post).toHaveBeenCalledWith("/betaAppLocalizations", {
        data: {
          type: "betaAppLocalizations",
          attributes: {
            locale: "de-DE",
            description: "Beta für Tester",
            feedbackEmail: "qa@example.com",
          },
          relationships: { app: { data: { type: "apps", id: "1" } } },
        },
      });
      expectContract(client);
    });

    it("updates only the provided app detail fields", async () => {
      client.patch.mockResolvedValueOnce({
        data: {
          type: "betaAppLocalizations",
          id: "al1",
          attributes: { marketingUrl: "https://example.com/beta", locale: "de-DE" },
        },
      });

      await updateBetaAppLocalization(asClient(client), {
        localizationId: "al1",
        marketingUrl: "https://example.com/beta",
      });

      expect(client.patch).toHaveBeenCalledWith("/betaAppLocalizations/al1", {
        data: {
          type: "betaAppLocalizations",
          id: "al1",
          attributes: { marketingUrl: "https://example.com/beta" },
        },
      });
      expectContract(client);
    });

    it("refuses an app detail update with no fields", async () => {
      const result = await updateBetaAppLocalization(asClient(client), { localizationId: "al1" });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("deletes app details", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteBetaAppLocalization(asClient(client), { localizationId: "al1" });

      expect(client.delete).toHaveBeenCalledWith("/betaAppLocalizations/al1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });
  });

  describe("beta App Review details", () => {
    it("never returns the demo password", async () => {
      client.get.mockResolvedValueOnce({ data: reviewDetail });

      const result = await getBetaAppReviewDetail(asClient(client), { appId: "1" });

      expect(client.get.mock.calls[0]?.[0]).toBe("/apps/1/betaAppReviewDetail");
      expect(result).toMatchObject({
        success: true,
        data: { id: "rd1", demoAccountPasswordSet: true },
      });
      expect(JSON.stringify(result)).not.toContain("s3cret-demo");
      expectContract(client);
    });

    it("updates only the provided review detail fields", async () => {
      client.patch.mockResolvedValueOnce({ data: reviewDetail });

      const result = await updateBetaAppReviewDetail(asClient(client), {
        reviewDetailId: "rd1",
        notes: "New notes",
      });

      expect(client.patch).toHaveBeenCalledWith("/betaAppReviewDetails/rd1", {
        data: { type: "betaAppReviewDetails", id: "rd1", attributes: { notes: "New notes" } },
      });
      expect(JSON.stringify(result)).not.toContain(reviewDetail.attributes.demoAccountPassword);
      expectContract(client);
    });

    it("never puts the demo password in an error", async () => {
      client.patch.mockRejectedValueOnce(
        new ASCError("Invalid demoAccountPassword 'hunter2-x'", "API_ERROR", 409, [
          { detail: "hunter2-x is too weak" },
        ])
      );

      const result = await updateBetaAppReviewDetail(asClient(client), {
        reviewDetailId: "rd1",
        demoAccountPassword: "hunter2-x",
      });

      expect(result).toMatchObject({ success: false });
      expect(JSON.stringify(result)).not.toContain("hunter2-x");
    });

    it("refuses notes over 4000 characters before calling the API", async () => {
      const result = await updateBetaAppReviewDetail(asClient(client), {
        reviewDetailId: "rd1",
        notes: "x".repeat(4001),
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("refuses a demo password over 100 characters before calling the API", async () => {
      const result = await updateBetaAppReviewDetail(asClient(client), {
        reviewDetailId: "rd1",
        demoAccountPassword: "p".repeat(101),
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("beta review submissions", () => {
    it("submits a build for beta review", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "betaAppReviewSubmissions",
          id: "s1",
          attributes: { betaReviewState: "WAITING_FOR_REVIEW" },
        },
      });

      const result = await submitBuildForBetaReview(asClient(client), { buildId: "b1" });

      expect(client.post).toHaveBeenCalledWith("/betaAppReviewSubmissions", {
        data: {
          type: "betaAppReviewSubmissions",
          relationships: { build: { data: { type: "builds", id: "b1" } } },
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { id: "s1", betaReviewState: "WAITING_FOR_REVIEW" },
      });
      expectContract(client);
    });

    it("filters submissions by build and joins review states with commas", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            type: "betaAppReviewSubmissions",
            id: "s1",
            attributes: { betaReviewState: "IN_REVIEW" },
          },
        ],
        links: {},
        meta: { paging: { total: 1 } },
      });

      const result = await listBetaReviewSubmissions(asClient(client), {
        buildId: "b1",
        betaReviewState: ["WAITING_FOR_REVIEW", "IN_REVIEW"],
      });

      expect(client.get).toHaveBeenCalledWith("/betaAppReviewSubmissions", {
        "filter[build]": "b1",
        "filter[betaReviewState]": "WAITING_FOR_REVIEW,IN_REVIEW",
        "fields[betaAppReviewSubmissions]": "betaReviewState,submittedDate",
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "s1", betaReviewState: "IN_REVIEW" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("build beta settings and pre-release versions", () => {
    it("reads the build beta detail", async () => {
      client.get.mockResolvedValueOnce({
        data: {
          type: "buildBetaDetails",
          id: "bd1",
          attributes: {
            autoNotifyEnabled: true,
            internalBuildState: "IN_BETA_TESTING",
            externalBuildState: "READY_FOR_BETA_SUBMISSION",
          },
        },
      });

      const result = await getBuildBetaDetail(asClient(client), { buildId: "b1" });

      expect(client.get).toHaveBeenCalledWith("/builds/b1/buildBetaDetail", {
        "fields[buildBetaDetails]": "autoNotifyEnabled,internalBuildState,externalBuildState",
      });
      expect(result).toMatchObject({ success: true, data: { id: "bd1", autoNotifyEnabled: true } });
      expectContract(client);
    });

    it("sends autoNotifyEnabled=false rather than dropping it", async () => {
      client.patch.mockResolvedValueOnce({
        data: { type: "buildBetaDetails", id: "bd1", attributes: { autoNotifyEnabled: false } },
      });

      await updateBuildBetaDetail(asClient(client), {
        buildBetaDetailId: "bd1",
        autoNotifyEnabled: false,
      });

      expect(client.patch).toHaveBeenCalledWith("/buildBetaDetails/bd1", {
        data: {
          type: "buildBetaDetails",
          id: "bd1",
          attributes: { autoNotifyEnabled: false },
        },
      });
      expectContract(client);
    });

    it("lists pre-release versions with the requested limit", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            type: "preReleaseVersions",
            id: "pv1",
            attributes: { version: "2.1.0", platform: "MAC_OS" },
          },
        ],
        links: {},
        meta: { paging: { total: 1 } },
      });

      const result = await listPreReleaseVersions(asClient(client), { appId: "1", limit: 5 });

      expect(client.get).toHaveBeenCalledWith("/apps/1/preReleaseVersions", {
        "fields[preReleaseVersions]": "version,platform",
        limit: 5,
      });
      expect(result).toEqual({
        success: true,
        data: [{ id: "pv1", version: "2.1.0", platform: "MAC_OS" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });
});
