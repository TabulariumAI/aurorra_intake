import { describe, expect, it } from "vitest";
import { SELECT_FILE_MAX_SIZE_BYTES, validateSelectFile } from "../service/selectFileHelper";

describe("selectFileHelper", () => {
  it("accepts supported document extensions within size limit", () => {
    expect(validateSelectFile({ name: "document.pdf", size: 100 })).toBeNull();
    expect(validateSelectFile({ name: "document.tiff", size: 100 })).toBeNull();
    expect(validateSelectFile({ name: "document.tif", size: 100 })).toBeNull();
  });

  it("rejects unsupported extensions and files over the limit", () => {
    expect(validateSelectFile({ name: "document.txt", size: 100 })).toBe("format");
    expect(validateSelectFile({ name: "document.pdf", size: SELECT_FILE_MAX_SIZE_BYTES + 1 })).toBe("size");
  });
});
