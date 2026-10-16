/**
 * Tests for TestFlight group tools (beta group CRUD, build and tester links, invitations)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  addBuildsToBetaGroup,
  addTestersToBetaGroup,
  createBetaGroup,
  deleteBetaGroup,
  deleteBetaTester,
  getBetaGroup,
  inviteBetaTester,
  listBetaGroupBuilds,
  removeBuildsFromBetaGroup,
  testflightGroupsToolsModule,
  updateBetaGroup,
} from "../src/tools/testflight-groups.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const betaGroup = {
  type: "betaGroups",
  id: "g1",
  attributes: {
    name: "Beta",
    isInternalGroup: false,
    publicLinkEnabled: true,
    publicLinkLimit: 50,
  },
};

const build = {
  type: "builds",
  id: "b1",
  attributes: { version: "42", processingState: "VALID", expired: false },
};

describe("testflight group tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("get_beta_group", () => {
    it("reads the group by ID", async () => {
      client.get.mockResolvedValueOnce({ data: betaGroup });

      const result = await getBetaGroup(asClient(client), { betaGroupId: "g1" });

      expect(client.get).toHaveBeenCalledWith(
        "/betaGroups/g1",
        expect.objectContaining({ "fields[betaGroups]": expect.any(String) })
      );
      expect(result).toMatchObject({
        success: true,
        data: { id: "g1", name: "Beta", publicLinkLimit: 50 },
      });
      expectContract(client);
    });

    it("rejects an ID that could change the request path", async () => {
      const result = await getBetaGroup(asClient(client), { betaGroupId: "../apps/1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.get).not.toHaveBeenCalled();
    });
  });

  describe("create_beta_group", () => {
    it("creates a group linked to the app with only the provided attributes", async () => {
      client.post.mockResolvedValueOnce({ data: betaGroup });

      const result = await createBetaGroup(asClient(client), {
        appId: "app1",
        name: "Beta",
        publicLinkEnabled: true,
        publicLinkLimit: 50,
      });

      expect(client.post).toHaveBeenCalledWith("/betaGroups", {
        data: {
          type: "betaGroups",
          attributes: { name: "Beta", publicLinkEnabled: true, publicLinkLimit: 50 },
          relationships: { app: { data: { type: "apps", id: "app1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "g1" } });
      expectContract(client);
    });
  });

  describe("update_beta_group", () => {
    it("patches only the provided attributes", async () => {
      client.patch.mockResolvedValueOnce({ data: betaGroup });

      await updateBetaGroup(asClient(client), {
        betaGroupId: "g1",
        publicLinkLimit: 100,
        feedbackEnabled: false,
      });

      expect(client.patch).toHaveBeenCalledWith("/betaGroups/g1", {
        data: {
          type: "betaGroups",
          id: "g1",
          attributes: { publicLinkLimit: 100, feedbackEnabled: false },
        },
      });
      expectContract(client);
    });

    it("refuses an update with no fields", async () => {
      const result = await updateBetaGroup(asClient(client), { betaGroupId: "g1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("delete_beta_group", () => {
    it("deletes the group", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteBetaGroup(asClient(client), { betaGroupId: "g1" });

      expect(client.delete).toHaveBeenCalledWith("/betaGroups/g1");
      expect(result).toMatchObject({
        success: true,
        data: { deleted: true, betaGroupId: "g1" },
      });
      expectContract(client);
    });
  });

  describe("list_beta_group_builds", () => {
    it("lists the group's builds with the limit applied", async () => {
      client.get.mockResolvedValueOnce({ data: [build], meta: { paging: { total: 3 } } });

      const result = await listBetaGroupBuilds(asClient(client), { betaGroupId: "g1", limit: 10 });

      expect(client.get).toHaveBeenCalledWith(
        "/betaGroups/g1/builds",
        expect.objectContaining({ limit: 10 })
      );
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "b1", version: "42" }],
        meta: { total: 3, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("add_builds_to_beta_group", () => {
    it("links builds through the to-many relationship endpoint", async () => {
      client.post.mockResolvedValueOnce(undefined);

      const result = await addBuildsToBetaGroup(asClient(client), {
        betaGroupId: "g1",
        buildIds: ["b1", "b2"],
      });

      expect(client.post).toHaveBeenCalledWith("/betaGroups/g1/relationships/builds", {
        data: [
          { type: "builds", id: "b1" },
          { type: "builds", id: "b2" },
        ],
      });
      expect(result).toMatchObject({ success: true });
      expectContract(client);
    });
  });

  describe("remove_builds_from_beta_group", () => {
    it("unlinks builds with the linkage document as the DELETE body", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      await removeBuildsFromBetaGroup(asClient(client), { betaGroupId: "g1", buildIds: ["b1"] });

      expect(client.delete).toHaveBeenCalledWith("/betaGroups/g1/relationships/builds", {
        data: [{ type: "builds", id: "b1" }],
      });
      expectContract(client);
    });
  });

  describe("add_testers_to_beta_group", () => {
    it("adds existing testers through the to-many relationship endpoint", async () => {
      client.post.mockResolvedValueOnce(undefined);

      await addTestersToBetaGroup(asClient(client), { betaGroupId: "g1", betaTesterIds: ["t1"] });

      expect(client.post).toHaveBeenCalledWith("/betaGroups/g1/relationships/betaTesters", {
        data: [{ type: "betaTesters", id: "t1" }],
      });
      expectContract(client);
    });
  });

  describe("delete_beta_tester", () => {
    it("deletes the tester by ID", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteBetaTester(asClient(client), { betaTesterId: "t1" });

      expect(client.delete).toHaveBeenCalledWith("/betaTesters/t1");
      expect(result).toMatchObject({
        success: true,
        data: { deleted: true, betaTesterId: "t1" },
      });
      expectContract(client);
    });
  });

  describe("invite_beta_tester", () => {
    it("creates an invitation linked to the app and the tester", async () => {
      client.post.mockResolvedValueOnce({ data: { type: "betaTesterInvitations", id: "inv1" } });

      const result = await inviteBetaTester(asClient(client), {
        appId: "app1",
        betaTesterId: "t1",
      });

      expect(client.post).toHaveBeenCalledWith("/betaTesterInvitations", {
        data: {
          type: "betaTesterInvitations",
          relationships: {
            app: { data: { type: "apps", id: "app1" } },
            betaTester: { data: { type: "betaTesters", id: "t1" } },
          },
        },
      });
      expect(result).toMatchObject({ success: true, data: { invitationId: "inv1" } });
      expectContract(client);
    });
  });

  describe("safeguards", () => {
    // Guards: an empty linkage array would send a no-op or ambiguous request to Apple.
    it.each([
      ["add_builds_to_beta_group", addBuildsToBetaGroup, { betaGroupId: "g1", buildIds: [] }],
      [
        "remove_builds_from_beta_group",
        removeBuildsFromBetaGroup,
        { betaGroupId: "g1", buildIds: [] },
      ],
      [
        "add_testers_to_beta_group",
        addTestersToBetaGroup,
        { betaGroupId: "g1", betaTesterIds: [] },
      ],
    ])(
      "%s refuses an empty linkage array without calling the API",
      async (_name, handler, input) => {
        const result = await handler(asClient(client), input);
        expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
        expect(client.post).not.toHaveBeenCalled();
        expect(client.delete).not.toHaveBeenCalled();
      }
    );

    // Guards: a destructive annotation is the only signal MCP clients get before a delete,
    // remove, or invitation runs, so losing it would silently drop the confirmation hint.
    it.each([
      "delete_beta_group",
      "delete_beta_tester",
      "remove_builds_from_beta_group",
      "invite_beta_tester",
    ])("%s is marked destructive", (name) => {
      const definition = testflightGroupsToolsModule.definitions.find((d) => d.name === name);
      expect(definition?.annotations?.destructiveHint).toBe(true);
    });

    // Guards: a second definition of add_beta_tester/remove_beta_tester would collide with
    // the existing tools in beta.tools.ts when the registry merges the toolsets.
    it("does not redefine the existing beta tester tools", () => {
      const names = testflightGroupsToolsModule.definitions.map((d) => d.name);
      expect(names).not.toContain("add_beta_tester");
      expect(names).not.toContain("remove_beta_tester");
    });
  });
});
