import { describe, expect, it } from "vitest";
import { validateSelectFile } from "../service/selectFileHelper";

describe("selectFileHelper", () => {
  it("accepts supported document extensions within size limit", () => {
    expect(validateSelectFile({ name: "document.pdf", size: 100 }, 20 * 1024 * 1024)).toBeNull();
    expect(validateSelectFile({ name: "document.tiff", size: 100 }, 20 * 1024 * 1024)).toBeNull();
    expect(validateSelectFile({ name: "document.tif", size: 100 }, 20 * 1024 * 1024)).toBeNull();
  });

  it("rejects unsupported extensions and files over the limit", () => {
    expect(validateSelectFile({ name: "document.txt", size: 100 }, 20 * 1024 * 1024)).toBe("format");
    expect(validateSelectFile({ name: "document.pdf", size: 20 * 1024 * 1024 + 1 }, 20 * 1024 * 1024)).toBe("size");
  });
});

it.each([12, 20])("accepts a %s MB document with a 20 MB limit", (sizeMb) => {
  expect(validateSelectFile({ name: "document.pdf", size: sizeMb * 1024 * 1024 }, 20 * 1024 * 1024)).toBeNull();
});
it("uses the supplied limit", () => {
  expect(validateSelectFile({ name: "document.pdf", size: 6 * 1024 * 1024 }, 5 * 1024 * 1024)).toBe("size");
});
