/**
 * Update check: startup reads only the cache; a background refresh asks npm at most once a day.
 */

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedNewerVersion, isNewerVersion, refreshLatestVersion } from "../src/update-check.js";

const DAY = 24 * 60 * 60 * 1000;

function npmResponse(version: string) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ version }), { status: 200 }));
}

describe("isNewerVersion", () => {
  it("compares release versions numerically and ignores pre-releases", () => {
    expect(isNewerVersion("2.0.2", "2.0.1")).toBe(true);
    expect(isNewerVersion("10.0.0", "9.9.9")).toBe(true);
    expect(isNewerVersion("2.0.1", "2.0.1")).toBe(false);
    expect(isNewerVersion("2.0.0", "2.0.1")).toBe(false);
    expect(isNewerVersion("3.0.0-beta.1", "2.0.1")).toBe(false);
  });
});

describe("update check", () => {
  let cacheFile: string;

  beforeEach(async () => {
    cacheFile = join(await mkdtemp(join(tmpdir(), "asc-update-")), "asc-mcp", "update-check.json");
  });

  it("refreshes from npm, then reports the newer version from the cache without a request", async () => {
    const fetchImpl = npmResponse("2.1.0");

    await refreshLatestVersion({ env: {}, fetchImpl, now: 1_000, cacheFile });
    expect(JSON.parse(await readFile(cacheFile, "utf8"))).toEqual({
      checkedAt: 1_000,
      latest: "2.1.0",
    });

    await expect(cachedNewerVersion("2.0.1", { env: {}, cacheFile })).resolves.toBe("2.1.0");
    await expect(cachedNewerVersion("2.1.0", { env: {}, cacheFile })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("asks npm at most once a day", async () => {
    const fetchImpl = npmResponse("2.0.1");
    await refreshLatestVersion({ env: {}, fetchImpl, now: 0, cacheFile });
    await refreshLatestVersion({ env: {}, fetchImpl, now: DAY - 1, cacheFile });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await refreshLatestVersion({ env: {}, fetchImpl, now: DAY, cacheFile });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does nothing when ASC_DISABLE_UPDATE_CHECK is set", async () => {
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, JSON.stringify({ checkedAt: 0, latest: "9.9.9" }));
    const env = { ASC_DISABLE_UPDATE_CHECK: "1" };
    const fetchImpl = npmResponse("9.9.9");

    await refreshLatestVersion({ env, fetchImpl, cacheFile });
    await expect(cachedNewerVersion("2.0.1", { env, cacheFile })).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("treats a corrupt cache as empty", async () => {
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, "not json");
    await expect(cachedNewerVersion("2.0.1", { env: {}, cacheFile })).resolves.toBeUndefined();

    const fetchImpl = npmResponse("2.0.2");
    await refreshLatestVersion({ env: {}, fetchImpl, cacheFile });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never throws when npm is unreachable or slow, or the cache cannot be written", async () => {
    // A file where the cache directory should be makes every cache write fail
    await writeFile(dirname(cacheFile), "");

    const offline = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    await expect(
      refreshLatestVersion({ env: {}, fetchImpl: offline, cacheFile })
    ).resolves.toBeUndefined();

    const slow = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );
    await expect(
      refreshLatestVersion({
        env: {},
        fetchImpl: slow as unknown as typeof fetch,
        cacheFile,
        timeoutMs: 20,
      })
    ).resolves.toBeUndefined();

    await expect(cachedNewerVersion("2.0.1", { env: {}, cacheFile })).resolves.toBeUndefined();
  });
});
