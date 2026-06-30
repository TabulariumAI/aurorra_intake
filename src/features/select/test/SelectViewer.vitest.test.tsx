import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const configurePdfWorker = vi.hoisted(() => vi.fn());
const auroraLensCtor = vi.hoisted(() =>
  vi.fn(function AuroraLensMock(this: unknown) {
    return {
      close: vi.fn(),
      exportTiff: vi.fn(),
      isDirty: vi.fn(() => false),
      nextPage: vi.fn(),
      previousPage: vi.fn(),
      showThumbnails: vi.fn(),
    };
  }),
);

vi.mock("@tabulariumai/aurora-lens", () => ({
  AuroraLens: auroraLensCtor,
  IndexedDbViewerSessionStore: vi.fn(),
  configurePdfWorker,
}));

vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({
  default: "pdf-worker-url",
}));

import { SelectViewer } from "../component/SelectViewer";

describe("SelectViewer", () => {
  it("configures the pdf worker before creating the viewer", () => {
    const { unmount } = render(<SelectViewer />);

    expect(configurePdfWorker).toHaveBeenCalledWith("pdf-worker-url");
    expect(auroraLensCtor).toHaveBeenCalledTimes(1);

    unmount();
  });
});
