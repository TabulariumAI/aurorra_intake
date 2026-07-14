import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSelectPanel } from "../hook/useSelectPanel";
import type { IntakeContainerActions } from "../../intake/type/intake.types";
import type { SelectService } from "../type/select.types";
import type { ViewerApi } from "../type/selectViewer.types";

function createActions(): IntakeContainerActions {
  return {
    showSelect: vi.fn(),
    showProvision: vi.fn(),
    clearHeader: vi.fn(),
  };
}

function createService(documentSelected = true): SelectService {
  return {
    clear: vi.fn(),
    isDocumentSelected: vi.fn(() => documentSelected),
    setDocumentSelected: vi.fn(),
    setPageCount: vi.fn(),
    emitRoute: vi.fn(async () => undefined),
    showSettings: vi.fn(),
    getProgressIntervalMs: vi.fn(() => 1000),
    createTiffFile: vi.fn((blob) => new File([blob], "review.tiff", { type: "image/tiff" })),
    getErrorMessage: vi.fn((_error, fallback) => fallback),
  };
}

function createViewerApi(restored: boolean): ViewerApi {
  return {
    decodeDoc: vi.fn(async () => undefined),
    restoreSession: vi.fn(async () => restored),
    isDirty: vi.fn(() => false),
    exportTiff: vi.fn(async () => new Blob()),
    showThumbnails: vi.fn(),
    close: vi.fn(),
  } as unknown as ViewerApi;
}

describe("useSelectPanel", () => {
  it("keeps pending restore viewer props when the service object changes", async () => {
    const actions = createActions();
    const firstService = createService();
    const secondService = createService();
    const dropTarget = document.createElement("section");

    const { result, rerender } = renderHook(
      ({ service }) => useSelectPanel({ dropTarget, actions, service }),
      { initialProps: { service: firstService } },
    );

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    rerender({ service: secondService });

    expect(result.current.mode).toBe("review");
    expect(result.current.viewer.visible).toBe(true);
    expect(result.current.viewer.props).not.toBeNull();
  });

  it("returns to select mode when stored lens restore is unavailable", async () => {
    const actions = createActions();
    const service = createService();
    const dropTarget = document.createElement("section");
    const { result } = renderHook(() => useSelectPanel({ dropTarget, actions, service }));

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    await act(async () => {
      result.current.viewer.props?.onApiReady?.(createViewerApi(false));
    });

    await waitFor(() => {
      expect(result.current.mode).toBe("select");
    });
    expect(result.current.viewer.visible).toBe(false);
    expect(service.setDocumentSelected).toHaveBeenCalledWith(false);
    expect(actions.showSelect).toHaveBeenLastCalledWith(
      "Select Document",
      "Drag and drop a PDF or multi-page TIFF, or select a file to begin.",
    );
  });
});
