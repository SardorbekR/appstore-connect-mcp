/**
 * Deliver downloaded text (e.g. a CSV of offer codes) inline when it is small, or as a new
 * local file when the caller asks for one. Large text is refused inline because MCP clients
 * truncate oversized tool results.
 */

import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { ASCError, ValidationError } from "./errors.js";

export const MAX_INLINE_TEXT_CHARS = 40_000;

export interface DeliveredText {
  lineCount: number;
  text?: string;
  savedTo?: string;
}

export function countNonEmptyLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

/**
 * Write to `savePath` (absolute, must not exist yet, owner-only permissions) or return inline.
 */
export async function deliverText(text: string, savePath?: string): Promise<DeliveredText> {
  const lineCount = countNonEmptyLines(text);

  if (savePath !== undefined) {
    if (!isAbsolute(savePath)) {
      throw new ValidationError("savePath must be an absolute path", "savePath");
    }
    try {
      // "wx" refuses to overwrite an existing file; codes are secrets, so owner-only access
      await writeFile(savePath, text, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new ASCError(`File already exists: ${savePath}`, "FILE_EXISTS", 409);
      }
      throw new ASCError(`Failed to write ${savePath}`, "FILE_WRITE_ERROR", 500);
    }
    return { lineCount, savedTo: savePath };
  }

  if (text.length > MAX_INLINE_TEXT_CHARS) {
    throw new ASCError(
      `The result has ${lineCount} lines (${text.length} characters), too large to return inline. Pass savePath to write it to a file.`,
      "TOO_LARGE",
      413
    );
  }
  return { lineCount, text };
}
