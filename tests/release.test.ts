/**
 * Tests for release tools (phased releases, release requests, encryption declarations,
 * build expiry and encryption flags)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  assignBuildsToEncryptionDeclaration,
  createEncryptionDeclaration,
  createPhasedRelease,
  deletePhasedRelease,
  getEncryptionDeclaration,
  getPhasedRelease,
  listEncryptionDeclarations,
  releaseAppVersion,
  releaseToolsModule,
  updateBuild,
  updatePhasedRelease,
} from "../src/tools/release.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const phasedRelease = {
  type: "appStoreVersionPhasedReleases",
  id: "pr1",
  attributes: { phasedReleaseState: "ACTIVE", currentDayNumber: 2, totalPauseDuration: 0 },
};

const declaration = {
  type: "appEncryptionDeclarations",
  id: "d1",
  attributes: {
    appDescription: "HTTPS only",
    usesEncryption: true,
    exempt: true,
    appEncryptionDeclarationState: "IN_REVIEW",
  },
};

const build = {
  type: "builds",
  id: "b1",
  attributes: { version: "42", processingState: "VALID", expired: false },
};

describe("release tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("get_phased_release", () => {
    it("reads the phased release of a version", async () => {
      client.get.mockResolvedValueOnce({ data: phasedRelease });

      const result = await getPhasedRelease(asClient(client), { versionId: "v1" });

      expect(client.get).toHaveBeenCalledWith("/appStoreVersions/v1/appStoreVersionPhasedRelease");
      expect(result).toMatchObject({
        success: true,
        data: { id: "pr1", phasedReleaseState: "ACTIVE" },
      });
      expectContract(client);
    });

    it("returns null when the version has no phased release", async () => {
      client.get.mockResolvedValueOnce({ data: null });

      const result = await getPhasedRelease(asClient(client), { versionId: "v1" });

      expect(result).toEqual({ success: true, data: null });
      expectContract(client);
    });
  });

  describe("create_phased_release", () => {
    it("links the new phased release to the version without attributes when no state is given", async () => {
      client.post.mockResolvedValueOnce({ data: phasedRelease });

      await createPhasedRelease(asClient(client), { versionId: "v1" });

      expect(client.post).toHaveBeenCalledWith("/appStoreVersionPhasedReleases", {
        data: {
          type: "appStoreVersionPhasedReleases",
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: "v1" } },
          },
        },
      });
      expectContract(client);
    });
  });

  describe("update_phased_release", () => {
    it("sets the phased release state", async () => {
      client.patch.mockResolvedValueOnce({ data: phasedRelease });

      await updatePhasedRelease(asClient(client), {
        phasedReleaseId: "pr1",
        phasedReleaseState: "PAUSED",
      });

      expect(client.patch).toHaveBeenCalledWith("/appStoreVersionPhasedReleases/pr1", {
        data: {
          type: "appStoreVersionPhasedReleases",
          id: "pr1",
          attributes: { phasedReleaseState: "PAUSED" },
        },
      });
      expectContract(client);
    });

    it("refuses COMPLETE without confirmReleaseToAll before calling the API", async () => {
      const result = await updatePhasedRelease(asClient(client), {
        phasedReleaseId: "pr1",
        phasedReleaseState: "COMPLETE",
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("sends COMPLETE once confirmed, without leaking the confirmation flag into the request", async () => {
      client.patch.mockResolvedValueOnce({ data: phasedRelease });

      await updatePhasedRelease(asClient(client), {
        phasedReleaseId: "pr1",
        phasedReleaseState: "COMPLETE",
        confirmReleaseToAll: true,
      });

      expect(client.patch).toHaveBeenCalledWith("/appStoreVersionPhasedReleases/pr1", {
        data: {
          type: "appStoreVersionPhasedReleases",
          id: "pr1",
          attributes: { phasedReleaseState: "COMPLETE" },
        },
      });
      expectContract(client);
    });
  });

  describe("delete_phased_release", () => {
    it("deletes the phased release", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deletePhasedRelease(asClient(client), { phasedReleaseId: "pr1" });

      expect(client.delete).toHaveBeenCalledWith("/appStoreVersionPhasedReleases/pr1");
      expect(result).toMatchObject({
        success: true,
        data: { deleted: true, phasedReleaseId: "pr1" },
      });
      expectContract(client);
    });
  });

  describe("release_app_version", () => {
    it("requests release of the version through the release request resource", async () => {
      client.post.mockResolvedValueOnce({
        data: { type: "appStoreVersionReleaseRequests", id: "rr1" },
      });

      const result = await releaseAppVersion(asClient(client), { versionId: "v1" });

      expect(client.post).toHaveBeenCalledWith("/appStoreVersionReleaseRequests", {
        data: {
          type: "appStoreVersionReleaseRequests",
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: "v1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { releaseRequestId: "rr1" } });
      expectContract(client);
    });
  });

  describe("list_encryption_declarations", () => {
    it("lists declarations for an app with the requested limit", async () => {
      client.get.mockResolvedValueOnce({
        data: [declaration],
        links: { self: "https://example.test" },
        meta: { paging: { total: 1, limit: 10 } },
      });

      const result = await listEncryptionDeclarations(asClient(client), { appId: "1", limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/appEncryptionDeclarations", {
        "filter[app]": "1",
        limit: 10,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "d1", state: "IN_REVIEW" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("get_encryption_declaration", () => {
    it("reads one declaration", async () => {
      client.get.mockResolvedValueOnce({ data: declaration });

      const result = await getEncryptionDeclaration(asClient(client), { declarationId: "d1" });

      expect(client.get).toHaveBeenCalledWith("/appEncryptionDeclarations/d1");
      expect(result).toMatchObject({ success: true, data: { id: "d1", exempt: true } });
      expectContract(client);
    });
  });

  describe("create_encryption_declaration", () => {
    it("creates a declaration with the four required answers linked to the app", async () => {
      client.post.mockResolvedValueOnce({ data: declaration });

      await createEncryptionDeclaration(asClient(client), {
        appId: "1",
        appDescription: "HTTPS only",
        containsProprietaryCryptography: false,
        containsThirdPartyCryptography: false,
        availableOnFrenchStore: true,
      });

      expect(client.post).toHaveBeenCalledWith("/appEncryptionDeclarations", {
        data: {
          type: "appEncryptionDeclarations",
          attributes: {
            appDescription: "HTTPS only",
            containsProprietaryCryptography: false,
            containsThirdPartyCryptography: false,
            availableOnFrenchStore: true,
          },
          relationships: { app: { data: { type: "apps", id: "1" } } },
        },
      });
      expectContract(client);
    });
  });

  describe("assign_builds_to_encryption_declaration", () => {
    it("sends the builds as a to-many linkage", async () => {
      client.post.mockResolvedValueOnce(undefined);

      const result = await assignBuildsToEncryptionDeclaration(asClient(client), {
        declarationId: "d1",
        buildIds: ["b1", "b2"],
      });

      expect(client.post).toHaveBeenCalledWith(
        "/appEncryptionDeclarations/d1/relationships/builds",
        {
          data: [
            { type: "builds", id: "b1" },
            { type: "builds", id: "b2" },
          ],
        }
      );
      expect(result).toMatchObject({ success: true, data: { declarationId: "d1" } });
      expectContract(client);
    });
  });

  describe("update_build", () => {
    it("sets the encryption flag and links the declaration in one PATCH", async () => {
      client.patch.mockResolvedValueOnce({ data: build });

      await updateBuild(asClient(client), {
        buildId: "b1",
        usesNonExemptEncryption: false,
        appEncryptionDeclarationId: "d1",
      });

      expect(client.patch).toHaveBeenCalledWith("/builds/b1", {
        data: {
          type: "builds",
          id: "b1",
          attributes: { usesNonExemptEncryption: false },
          relationships: {
            appEncryptionDeclaration: { data: { type: "appEncryptionDeclarations", id: "d1" } },
          },
        },
      });
      expectContract(client);
    });

    it("refuses to expire a build without confirmExpire before calling the API", async () => {
      const result = await updateBuild(asClient(client), { buildId: "b1", expired: true });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("expires a build once confirmed, without leaking the confirmation flag into the request", async () => {
      client.patch.mockResolvedValueOnce({ data: { ...build, attributes: { expired: true } } });

      await updateBuild(asClient(client), { buildId: "b1", expired: true, confirmExpire: true });

      expect(client.patch).toHaveBeenCalledWith("/builds/b1", {
        data: { type: "builds", id: "b1", attributes: { expired: true } },
      });
      expectContract(client);
    });
  });

  describe("destructive annotations", () => {
    it("marks releases, deletes, and irreversible updates as destructive", () => {
      const destructive = releaseToolsModule.definitions
        .filter((definition) => definition.annotations?.destructiveHint === true)
        .map((definition) => definition.name)
        .sort();

      expect(destructive).toEqual([
        "delete_phased_release",
        "release_app_version",
        "update_build",
        "update_phased_release",
      ]);
    });
  });
});
