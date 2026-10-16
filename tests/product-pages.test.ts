/**
 * Tests for product page tools (custom product pages, their versions, and localizations)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createCppLocalization,
  createCppVersion,
  createCustomProductPage,
  deleteCppLocalization,
  deleteCustomProductPage,
  getCustomProductPage,
  listCppLocalizations,
  listCppVersions,
  listCustomProductPages,
  productPagesToolsModule,
  updateCppLocalization,
  updateCustomProductPage,
} from "../src/tools/product-pages.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const customProductPage = {
  type: "appCustomProductPages",
  id: "cpp1",
  attributes: {
    name: "Summer",
    url: "https://apps.apple.com/app/id1?ppid=cpp1",
    visible: true,
  },
};

const customProductPageVersion = {
  type: "appCustomProductPageVersions",
  id: "ver1",
  attributes: {
    version: "1",
    state: "PREPARE_FOR_SUBMISSION",
    deepLink: "https://example.com/summer",
  },
};

const customProductPageLocalization = {
  type: "appCustomProductPageLocalizations",
  id: "loc1",
  attributes: { locale: "en-US", promotionalText: "Try it free" },
};

describe("product page tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("custom product pages", () => {
    it("lists an app's pages with the visibility filter and paging meta", async () => {
      client.get.mockResolvedValueOnce({
        data: [customProductPage],
        meta: { paging: { total: 3, limit: 10 } },
      });

      const result = await listCustomProductPages(asClient(client), {
        appId: "1",
        visible: true,
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith("/apps/1/appCustomProductPages", {
        "filter[visible]": "true",
        limit: 10,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "cpp1", visible: true }],
        meta: { total: 3, returned: 1 },
      });
      expectContract(client);
    });

    it("gets one page by ID", async () => {
      client.get.mockResolvedValueOnce({ data: customProductPage });

      const result = await getCustomProductPage(asClient(client), { customProductPageId: "cpp1" });

      expect(client.get.mock.calls[0]?.[0]).toBe("/appCustomProductPages/cpp1");
      expect(result).toMatchObject({ success: true, data: { id: "cpp1", name: "Summer" } });
      expectContract(client);
    });

    it("creates a page with its first version and a primary-locale localization", async () => {
      client.get.mockResolvedValueOnce({
        data: { type: "apps", id: "1", attributes: { primaryLocale: "en-US" } },
      });
      client.post.mockResolvedValueOnce({ data: customProductPage });

      await createCustomProductPage(asClient(client), { appId: "1", name: "Summer" });

      expect(client.get).toHaveBeenCalledWith("/apps/1", { "fields[apps]": "primaryLocale" });
      expect(client.post).toHaveBeenCalledWith("/appCustomProductPages", {
        data: {
          type: "appCustomProductPages",
          attributes: { name: "Summer" },
          relationships: {
            app: { data: { type: "apps", id: "1" } },
            appCustomProductPageVersions: {
              data: [
                { type: "appCustomProductPageVersions", id: "${new-appCustomProductPageVersion}" },
              ],
            },
          },
        },
        included: [
          {
            type: "appCustomProductPageVersions",
            id: "${new-appCustomProductPageVersion}",
            relationships: {
              appCustomProductPageLocalizations: {
                data: [
                  {
                    type: "appCustomProductPageLocalizations",
                    id: "${new-appCustomProductPageLocalization}",
                  },
                ],
              },
            },
          },
          {
            type: "appCustomProductPageLocalizations",
            id: "${new-appCustomProductPageLocalization}",
            attributes: { locale: "en-US" },
          },
        ],
      });
      expectContract(client);
    });

    it("uses the given locale and promotional text without reading the app", async () => {
      client.post.mockResolvedValueOnce({ data: customProductPage });

      await createCustomProductPage(asClient(client), {
        appId: "1",
        name: "Summer",
        locale: "de-DE",
        promotionalText: "Sommer",
      });

      expect(client.get).not.toHaveBeenCalled();
      expect(client.post.mock.calls[0]?.[1].included[1].attributes).toEqual({
        locale: "de-DE",
        promotionalText: "Sommer",
      });
      expectContract(client);
    });

    it("updates only the fields provided, including visible false", async () => {
      client.patch.mockResolvedValueOnce({
        data: {
          ...customProductPage,
          attributes: { ...customProductPage.attributes, visible: false },
        },
      });

      const result = await updateCustomProductPage(asClient(client), {
        customProductPageId: "cpp1",
        visible: false,
      });

      expect(client.patch).toHaveBeenCalledWith("/appCustomProductPages/cpp1", {
        data: { type: "appCustomProductPages", id: "cpp1", attributes: { visible: false } },
      });
      expect(result).toMatchObject({ success: true, data: { id: "cpp1" } });
      expectContract(client);
    });

    it("refuses an update with no fields", async () => {
      const result = await updateCustomProductPage(asClient(client), {
        customProductPageId: "cpp1",
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("deletes a page by ID", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteCustomProductPage(asClient(client), {
        customProductPageId: "cpp1",
      });

      expect(client.delete).toHaveBeenCalledWith("/appCustomProductPages/cpp1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });
  });

  describe("custom product page versions", () => {
    it("filters versions by review state, joining several states with commas", async () => {
      client.get.mockResolvedValueOnce({ data: [customProductPageVersion] });

      const result = await listCppVersions(asClient(client), {
        customProductPageId: "cpp1",
        states: ["READY_FOR_REVIEW", "IN_REVIEW"],
      });

      expect(client.get).toHaveBeenCalledWith(
        "/appCustomProductPages/cpp1/appCustomProductPageVersions",
        { "filter[state]": "READY_FOR_REVIEW,IN_REVIEW" }
      );
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "ver1", state: "PREPARE_FOR_SUBMISSION" }],
      });
      expectContract(client);
    });

    it("creates a version linked to its page with a deep link", async () => {
      client.post.mockResolvedValueOnce({ data: customProductPageVersion });

      await createCppVersion(asClient(client), {
        customProductPageId: "cpp1",
        deepLink: "https://example.com/summer",
      });

      expect(client.post).toHaveBeenCalledWith("/appCustomProductPageVersions", {
        data: {
          type: "appCustomProductPageVersions",
          attributes: { deepLink: "https://example.com/summer" },
          relationships: {
            appCustomProductPage: { data: { type: "appCustomProductPages", id: "cpp1" } },
          },
        },
      });
      expectContract(client);
    });
  });

  describe("custom product page localizations", () => {
    it("lists a version's localizations filtered by locale", async () => {
      client.get.mockResolvedValueOnce({ data: [customProductPageLocalization] });

      const result = await listCppLocalizations(asClient(client), {
        versionId: "ver1",
        locales: ["en-US", "de-DE"],
      });

      expect(client.get).toHaveBeenCalledWith(
        "/appCustomProductPageVersions/ver1/appCustomProductPageLocalizations",
        { "filter[locale]": "en-US,de-DE" }
      );
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "loc1", locale: "en-US" }],
      });
      expectContract(client);
    });

    it("creates a localization linked to its version", async () => {
      client.post.mockResolvedValueOnce({ data: customProductPageLocalization });

      await createCppLocalization(asClient(client), {
        versionId: "ver1",
        locale: "en-US",
        promotionalText: "Try it free",
      });

      expect(client.post).toHaveBeenCalledWith("/appCustomProductPageLocalizations", {
        data: {
          type: "appCustomProductPageLocalizations",
          attributes: { locale: "en-US", promotionalText: "Try it free" },
          relationships: {
            appCustomProductPageVersion: {
              data: { type: "appCustomProductPageVersions", id: "ver1" },
            },
          },
        },
      });
      expectContract(client);
    });

    it("clears promotional text when given null", async () => {
      client.patch.mockResolvedValueOnce({
        data: {
          ...customProductPageLocalization,
          attributes: { ...customProductPageLocalization.attributes, promotionalText: null },
        },
      });

      await updateCppLocalization(asClient(client), {
        localizationId: "loc1",
        promotionalText: null,
      });

      expect(client.patch).toHaveBeenCalledWith("/appCustomProductPageLocalizations/loc1", {
        data: {
          type: "appCustomProductPageLocalizations",
          id: "loc1",
          attributes: { promotionalText: null },
        },
      });
      expectContract(client);
    });

    it("deletes a localization by ID", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteCppLocalization(asClient(client), { localizationId: "loc1" });

      expect(client.delete).toHaveBeenCalledWith("/appCustomProductPageLocalizations/loc1");
      expect(result).toMatchObject({
        success: true,
        data: { deleted: true, localizationId: "loc1" },
      });
      expectContract(client);
    });
  });

  describe("safeguards", () => {
    it("marks every delete tool destructiveHint", () => {
      const deletes = productPagesToolsModule.definitions.filter((def) =>
        def.name.startsWith("delete_")
      );

      expect(deletes.map((def) => def.name)).toEqual([
        "delete_custom_product_page",
        "delete_cpp_localization",
      ]);
      for (const def of deletes) {
        expect(def.annotations?.destructiveHint).toBe(true);
      }
    });

    it("never calls DELETE for an ID that could change the request path", async () => {
      const pageResult = await deleteCustomProductPage(asClient(client), {
        customProductPageId: "../apps/1",
      });
      const localizationResult = await deleteCppLocalization(asClient(client), {
        localizationId: "loc1/../../x",
      });

      expect(pageResult).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(localizationResult).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(client.delete).not.toHaveBeenCalled();
    });
  });
});
