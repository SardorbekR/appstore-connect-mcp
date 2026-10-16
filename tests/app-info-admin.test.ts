/**
 * Tests for app info admin tools (categories, age rating declaration, app info localizations, EULA)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createAppInfoLocalization,
  createEula,
  deleteAppInfoLocalization,
  deleteEula,
  getAgeRatingDeclaration,
  getAppInfoCategories,
  getEula,
  listAppSubcategories,
  setAppCategories,
  updateAgeRatingDeclaration,
  updateEula,
} from "../src/tools/app-info-admin.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const CATEGORY_INCLUDE =
  "primaryCategory,primarySubcategoryOne,primarySubcategoryTwo,secondaryCategory,secondarySubcategoryOne,secondarySubcategoryTwo";

const ageRating = {
  type: "ageRatingDeclarations",
  id: "ard1",
  attributes: {
    gambling: false,
    socialMedia: false,
    userGeneratedContent: false,
    violenceRealistic: "NONE",
  },
};

const eula = {
  type: "endUserLicenseAgreements",
  id: "eula1",
  attributes: { agreementText: "Terms of use" },
};

describe("app info admin tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("get_app_info_categories", () => {
    it("reads the category ID in each slot, null when unset", async () => {
      client.get.mockResolvedValueOnce({
        data: {
          type: "appInfos",
          id: "ai1",
          relationships: {
            primaryCategory: { data: { type: "appCategories", id: "GAMES" } },
            primarySubcategoryOne: { data: { type: "appCategories", id: "GAMES_ACTION" } },
            secondaryCategory: { data: null },
          },
        },
      });

      const result = await getAppInfoCategories(asClient(client), { appInfoId: "ai1" });

      expect(client.get).toHaveBeenCalledWith("/appInfos/ai1", { include: CATEGORY_INCLUDE });
      expect(result).toMatchObject({
        success: true,
        data: {
          id: "ai1",
          primaryCategoryId: "GAMES",
          primarySubcategoryOneId: "GAMES_ACTION",
          secondaryCategoryId: null,
        },
      });
      expectContract(client);
    });
  });

  describe("set_app_categories", () => {
    it("patches only the category slots provided", async () => {
      client.patch.mockResolvedValueOnce(undefined);

      const result = await setAppCategories(asClient(client), {
        appInfoId: "ai1",
        primaryCategoryId: "GAMES",
        secondarySubcategoryOneId: "GAMES_ACTION",
      });

      expect(client.patch).toHaveBeenCalledWith("/appInfos/ai1", {
        data: {
          type: "appInfos",
          id: "ai1",
          relationships: {
            primaryCategory: { data: { type: "appCategories", id: "GAMES" } },
            secondarySubcategoryOne: { data: { type: "appCategories", id: "GAMES_ACTION" } },
          },
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { updated: { primaryCategoryId: "GAMES" } },
      });
      expectContract(client);
    });

    it("refuses an update with no category slots", async () => {
      const result = await setAppCategories(asClient(client), { appInfoId: "ai1" });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("list_app_subcategories", () => {
    it("lists subcategories with the total", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          { type: "appCategories", id: "GAMES_ACTION", attributes: { platforms: ["MAC_OS"] } },
        ],
        meta: { paging: { total: 1, limit: 50 } },
      });

      const result = await listAppSubcategories(asClient(client), {
        categoryId: "GAMES",
        limit: 50,
      });

      expect(client.get).toHaveBeenCalledWith("/appCategories/GAMES/subcategories", { limit: 50 });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "GAMES_ACTION" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("age rating declaration", () => {
    it("reads the declaration and rejects an ID that could change the path", async () => {
      client.get.mockResolvedValueOnce({ data: ageRating });

      const result = await getAgeRatingDeclaration(asClient(client), { appInfoId: "ai1" });

      expect(client.get).toHaveBeenCalledWith("/appInfos/ai1/ageRatingDeclaration");
      expect(result).toMatchObject({
        success: true,
        data: { id: "ard1", violenceRealistic: "NONE" },
      });
      expectContract(client);

      const badId = await getAgeRatingDeclaration(asClient(client), { appInfoId: "../apps/1" });
      expect(badId).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.get).toHaveBeenCalledTimes(1);
    });

    it("patches only the attributes provided", async () => {
      client.patch.mockResolvedValueOnce({ data: ageRating });

      await updateAgeRatingDeclaration(asClient(client), {
        declarationId: "ard1",
        attributes: { gambling: false, violenceRealistic: "NONE" },
      });

      expect(client.patch).toHaveBeenCalledWith("/ageRatingDeclarations/ard1", {
        data: {
          type: "ageRatingDeclarations",
          id: "ard1",
          attributes: { gambling: false, violenceRealistic: "NONE" },
        },
      });
      expectContract(client);
    });

    it("clears kidsAgeBand with null", async () => {
      client.patch.mockResolvedValueOnce({ data: ageRating });

      await updateAgeRatingDeclaration(asClient(client), {
        declarationId: "ard1",
        attributes: { kidsAgeBand: null },
      });

      expect(client.patch.mock.calls[0]?.[1].data.attributes).toEqual({ kidsAgeBand: null });
      expectContract(client);
    });

    it("refuses socialMedia=true together with userGeneratedContent=false", async () => {
      const result = await updateAgeRatingDeclaration(asClient(client), {
        declarationId: "ard1",
        attributes: { socialMedia: true, userGeneratedContent: false },
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("rejects attribute names that are not in the spec, and an empty update", async () => {
      const invented = await updateAgeRatingDeclaration(asClient(client), {
        declarationId: "ard1",
        attributes: { bogusRating: true },
      });
      expect(invented).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });

      const empty = await updateAgeRatingDeclaration(asClient(client), {
        declarationId: "ard1",
        attributes: {},
      });
      expect(empty).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });

      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("app info localizations", () => {
    it("creates a localization linked to the app info", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "appInfoLocalizations",
          id: "ail1",
          attributes: { locale: "de-DE", name: "Client Log", subtitle: "Short" },
        },
      });

      const result = await createAppInfoLocalization(asClient(client), {
        appInfoId: "ai1",
        locale: "de-DE",
        name: "Client Log",
        subtitle: "Short",
      });

      expect(client.post).toHaveBeenCalledWith("/appInfoLocalizations", {
        data: {
          type: "appInfoLocalizations",
          attributes: { locale: "de-DE", name: "Client Log", subtitle: "Short" },
          relationships: { appInfo: { data: { type: "appInfos", id: "ai1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "ail1", locale: "de-DE" } });
      expectContract(client);
    });

    it("deletes a localization", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteAppInfoLocalization(asClient(client), { localizationId: "ail1" });

      expect(client.delete).toHaveBeenCalledWith("/appInfoLocalizations/ail1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });
  });

  describe("EULA", () => {
    it("reads the custom EULA of an app", async () => {
      client.get.mockResolvedValueOnce({ data: eula });

      const result = await getEula(asClient(client), { appId: "app1" });

      expect(client.get).toHaveBeenCalledWith("/apps/app1/endUserLicenseAgreement");
      expect(result).toMatchObject({
        success: true,
        data: { id: "eula1", agreementText: "Terms of use" },
      });
      expectContract(client);
    });

    it("returns null when the app has no custom EULA", async () => {
      client.get.mockResolvedValueOnce({ data: null });

      const result = await getEula(asClient(client), { appId: "app1" });

      expect(result).toEqual({ success: true, data: null });
      expectContract(client);
    });

    it("creates the EULA for the given territories", async () => {
      client.post.mockResolvedValueOnce({ data: eula });

      await createEula(asClient(client), {
        appId: "app1",
        agreementText: "Terms of use",
        territories: ["USA", "GBR"],
      });

      expect(client.post).toHaveBeenCalledWith("/endUserLicenseAgreements", {
        data: {
          type: "endUserLicenseAgreements",
          attributes: { agreementText: "Terms of use" },
          relationships: {
            app: { data: { type: "apps", id: "app1" } },
            territories: {
              data: [
                { type: "territories", id: "USA" },
                { type: "territories", id: "GBR" },
              ],
            },
          },
        },
      });
      expectContract(client);
    });

    it("updates only the territories when no text is given", async () => {
      client.patch.mockResolvedValueOnce({ data: eula });

      await updateEula(asClient(client), { eulaId: "eula1", territories: ["USA"] });

      expect(client.patch).toHaveBeenCalledWith("/endUserLicenseAgreements/eula1", {
        data: {
          type: "endUserLicenseAgreements",
          id: "eula1",
          relationships: { territories: { data: [{ type: "territories", id: "USA" }] } },
        },
      });
      expectContract(client);
    });

    it("refuses an EULA update with neither text nor territories", async () => {
      const result = await updateEula(asClient(client), { eulaId: "eula1" });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("deletes the EULA", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteEula(asClient(client), { eulaId: "eula1" });

      expect(client.delete).toHaveBeenCalledWith("/endUserLicenseAgreements/eula1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });
  });
});
