/**
 * Error sanitization: secrets are redacted, resource IDs are not.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ASCError, formatErrorResponse, parseAPIError } from "../src/utils/errors.js";

const ISSUER = "69a6de70-1234-47e3-e053-5b8c7c11a4d1";

describe("error sanitization", () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.APP_STORE_CONNECT_ISSUER_ID;
    process.env.APP_STORE_CONNECT_ISSUER_ID = ISSUER;
  });

  afterEach(() => {
    if (previous === undefined) Reflect.deleteProperty(process.env, "APP_STORE_CONNECT_ISSUER_ID");
    else process.env.APP_STORE_CONNECT_ISSUER_ID = previous;
  });

  it("keeps UUID resource IDs that the caller needs (e.g. a conflicting review submission)", () => {
    const submissionId = "4a1c2b3d-0000-4e5f-8a9b-123456789abc";
    const error = parseAPIError(409, {
      errors: [{ detail: `already added to another reviewSubmission with id ${submissionId}` }],
    });
    const response = formatErrorResponse(error);
    expect(response.error.message).toContain(submissionId);
    expect(JSON.stringify(response.error.details)).toContain(submissionId);
  });

  it("redacts the issuer ID from the message and from details", () => {
    const error = new ASCError(`issuer ${ISSUER} rejected`, "AUTH_ERROR", 401, [
      { detail: `issuer ${ISSUER}`, source: { parameter: ISSUER } },
    ]);
    const serialized = JSON.stringify(formatErrorResponse(error));
    expect(serialized).not.toContain(ISSUER);
    expect(serialized).toContain("[REDACTED]");
  });

  it("redacts caller-supplied secrets such as a demo account password everywhere", () => {
    const password = "hunter2-demo";
    const error = parseAPIError(409, {
      errors: [{ detail: `demoAccountPassword '${password}' is invalid`, title: password }],
    });
    const serialized = JSON.stringify(formatErrorResponse(error, [password]));
    expect(serialized).not.toContain(password);
  });

  it("redacts supplied secrets however short they are", () => {
    const error = parseAPIError(409, { errors: [{ detail: "password xy rejected" }] });
    expect(JSON.stringify(formatErrorResponse(error, ["xy"]))).not.toContain("xy");
  });

  it("keeps the error code intact when a one-letter secret is redacted", () => {
    const error = parseAPIError(500, {
      errors: [{ code: "ENTITY_ERROR.ATTRIBUTE.INVALID", detail: "password A rejected" }],
    });
    const response = formatErrorResponse(error, ["A"]);
    expect(response.error.code).toBe("API_ERROR");
    expect(response.error.details).toMatchObject([{ code: "ENTITY_ERROR.ATTRIBUTE.INVALID" }]);
    expect(response.error.message).not.toContain(" A ");
  });

  it("redacts bearer tokens from plain errors", () => {
    const response = formatErrorResponse(new Error("sent Bearer aaa.bbb.ccc"));
    expect(response.error.message).not.toContain("aaa.bbb.ccc");
  });
});
