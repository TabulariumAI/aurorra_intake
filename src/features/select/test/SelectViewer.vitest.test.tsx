import { pageSize } from "../../../test/pageSize";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewerOptions, ViewerState } from "@tabulariumai/aurora-lens";

const auroraLensCtor = vi.hoisted(() =>
  vi.fn(function AuroraLensMock(this: unknown, _container: HTMLElement, _options: unknown) {
    return {
      close: vi.fn(),
      exportTiff: vi.fn(),
      isDirty: vi.fn(() => false),
      nextPage: vi.fn(async () => {}),
      previousPage: vi.fn(async () => {}),
      showThumbnails: vi.fn(async () => {}),
    };
  }),
);

vi.mock("@tabulariumai/aurora-lens", () => ({
  AuroraLens: auroraLensCtor,
  IndexedDbViewerSessionStore: vi.fn(),
}));

import { SelectViewer } from "../component/SelectViewer";

describe("SelectViewer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports a rejected navigation without an unhandled promise", async () => {
    const onError = vi.fn();
    const { unmount } = render(<SelectViewer pageSize={pageSize} onError={onError} />);
    const options = auroraLensCtor.mock.calls[0][1] as ViewerOptions;
    const viewer = auroraLensCtor.mock.results[0].value;
    viewer.nextPage.mockImplementationOnce(async () => {
      const error = new Error("navigation failed");
      options.onError?.(error);
      throw error;
    });
    act(() => options.onStateChange?.({ viewMode: "page", canGoNext: true } as ViewerState));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "navigation failed" })));
    expect(onError).toHaveBeenCalledTimes(1);
    unmount();
  });
  it("creates the package-owned viewer", () => {
    const { unmount } = render(<SelectViewer pageSize={pageSize} />);

    expect(auroraLensCtor).toHaveBeenCalledTimes(1);
    expect(auroraLensCtor.mock.calls[0][1]).toMatchObject({ pageSize });

    unmount();
  });
});
