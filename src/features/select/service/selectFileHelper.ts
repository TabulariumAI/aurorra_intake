import type { SelectFileValidationResult } from "../type/select.types";

export const SELECT_FILE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function validateSelectFile(file: Pick<File, "name" | "size">): SelectFileValidationResult {
  if (!/\.(pdf|tiff?|tif)$/i.test(file.name)) {
    return "format";
  }
  if (file.size > SELECT_FILE_MAX_SIZE_BYTES) {
    return "size";
  }
  return null;
}
