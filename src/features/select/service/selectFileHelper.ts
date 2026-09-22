import type { SelectFileValidationResult } from "../type/select.types";

export function validateSelectFile(file: Pick<File, "name" | "size">, maxFileSizeBytes: number): SelectFileValidationResult {
  if (!/\.(pdf|tiff?|tif)$/i.test(file.name)) {
    return "format";
  }
  if (file.size > maxFileSizeBytes) {
    return "size";
  }
  return null;
}
