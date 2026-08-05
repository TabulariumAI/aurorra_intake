import { act, renderHook, waitFor } from "@testing-library/react";
import type { ViewerState } from "@tabulariumai/aurora-lens";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSelectPanel } from "../hook/useSelectPanel";
import type { IntakeContainerActions } from "../../intake/type/intake.types";
import type { SelectService } from "../type/select.types";
import type { ViewerApi } from "../type/selectViewer.types";

const deleteStoredViewerSession = vi.hoisted(() => vi.fn());

vi.mock("@tabulariumai/aurora-lens", () => ({
  IndexedDbViewerSessionStore: class {
    delete = deleteStoredViewerSession;
  },
}));

beforeEach(() => {
  deleteStoredViewerSession.mockReset();
  deleteStoredViewerSession.mockResolvedValue(undefined);
});

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
    start: vi.fn(async (_pageCount, getDocument) => {
      await getDocument();
    }),
    showSettings: vi.fn(),
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
    clear: vi.fn(),
    close: vi.fn(),
  } as unknown as ViewerApi;
}

function createViewerState(pageCount: number): ViewerState {
  return {
    canActualSize: true,
    canClearSelection: false,
    canCopy: false,
    canDraw: true,
    canFitHeight: true,
    canFitPage: true,
    canFitWidth: true,
    canGoFirst: false,
    canGoLast: pageCount > 1,
    canGoNext: pageCount > 1,
    canGoPrevious: false,
    canSearch: true,
    canShowThumbnails: true,
    canZoomIn: true,
    canZoomOut: true,
    coordinates: null,
    displayCoordinates: null,
    drawMode: false,
    metadataPageCount: pageCount,
    pageCount,
    pageHeight: 1000,
    pageIndex: 0,
    pageInfo: null,
    pageWidth: 800,
    selectionCounts: { context: 0, figures: 0, tokens: 0 },
    sourceName: "document.pdf",
    status: "ready",
    viewMode: "thumbnails",
    zoom: 1,
  };
}

function deferred<Value>() {
  let resolve: (value: Value | PromiseLike<Value>) => void = () => undefined;
  const promise = new Promise<Value>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("useSelectPanel", () => {
  it("reports loading without package progress presentation", async () => {
    const actions = createActions();
    const service = createService(false);
    const decode = deferred<void>();
    const viewer = createViewerApi(false);
    viewer.decodeDoc = vi.fn(() => decode.promise);
    const { result } = renderHook(() => useSelectPanel({ actions, service }));

    let selectFile: Promise<void> = Promise.resolve();
    act(() => {
      selectFile = result.current.actions.selectFile(new File(["document"], "document.pdf", { type: "application/pdf" }));
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });
    act(() => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });
    await waitFor(() => {
      expect(viewer.decodeDoc).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toHaveProperty("loading", true);
    expect(result.current).not.toHaveProperty("progress");

    await act(async () => {
      decode.resolve();
      await selectFile;
    });

    expect(result.current).toHaveProperty("loading", false);
  });

  it("keeps pending restore viewer props when the service object changes", async () => {
    const actions = createActions();
    const firstService = createService();
    const secondService = createService();
    const { result, rerender } = renderHook(
      ({ service }) => useSelectPanel({ actions, service }),
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
    const { result } = renderHook(() => useSelectPanel({ actions, service }));

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

  it("closes the restored Aurora Lens when the select panel unmounts", async () => {
    const actions = createActions();
    const service = createService();
    const viewer = createViewerApi(true);
    const { result, unmount } = renderHook(() => useSelectPanel({ actions, service }));

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    await act(async () => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });

    await waitFor(() => {
      expect(service.setDocumentSelected).toHaveBeenCalledWith(true);
    });

    unmount();

    expect(viewer.close).toHaveBeenCalledTimes(1);
  });

  it("keeps normal cancellation as a close without clearing the persisted session", async () => {
    const actions = createActions();
    const service = createService();
    const viewer = createViewerApi(true);
    const { result } = renderHook(() => useSelectPanel({ actions, service }));

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    await act(async () => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });

    await waitFor(() => {
      expect(service.setDocumentSelected).toHaveBeenCalledWith(true);
    });

    act(() => {
      result.current.actions.cancel();
    });

    await waitFor(() => {
      expect(result.current.mode).toBe("select");
    });
    expect(service.setDocumentSelected).toHaveBeenLastCalledWith(false);
    expect(viewer.close).toHaveBeenCalledTimes(1);
    expect(viewer.clear).not.toHaveBeenCalled();
    expect(deleteStoredViewerSession).not.toHaveBeenCalled();
  });

  it("clears intake selection and the persisted Aurora Lens session for a new session", async () => {
    const actions = createActions();
    let documentSelected = true;
    const service = {
      ...createService(),
      clear: vi.fn(() => {
        documentSelected = false;
      }),
      isDocumentSelected: vi.fn(() => documentSelected),
    };
    const viewer = createViewerApi(true);
    const { result, rerender } = renderHook(
      ({ selectionResetVersion }) => useSelectPanel({
        actions,
        service,
        selectionResetVersion,
      }),
      { initialProps: { selectionResetVersion: 0 } },
    );

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    await act(async () => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });

    await waitFor(() => {
      expect(service.setDocumentSelected).toHaveBeenCalledWith(true);
    });

    rerender({ selectionResetVersion: 1 });

    await waitFor(() => {
      expect(result.current.mode).toBe("select");
    });
    expect(service.clear).toHaveBeenCalledTimes(1);
    expect(viewer.clear).toHaveBeenCalledTimes(1);
    expect(viewer.close).not.toHaveBeenCalled();
    expect(deleteStoredViewerSession).not.toHaveBeenCalled();
    expect(actions.showSelect).toHaveBeenLastCalledWith(
      "Select Document",
      "Drag and drop a PDF or multi-page TIFF, or select a file to begin.",
    );

    act(() => {
      result.current.actions.initialize();
    });

    expect(viewer.restoreSession).toHaveBeenCalledTimes(1);
  });

  it("clears the persisted selection before Intake mounts after a metadata reset", async () => {
    const actions = createActions();
    let documentSelected = true;
    const service = {
      ...createService(),
      clear: vi.fn(() => {
        documentSelected = false;
      }),
      isDocumentSelected: vi.fn(() => documentSelected),
    };
    const { result } = renderHook(() => useSelectPanel({
      actions,
      service,
      selectionResetVersion: 1,
    }));

    await waitFor(() => {
      expect(service.clear).toHaveBeenCalledTimes(1);
    });
    expect(deleteStoredViewerSession).toHaveBeenCalledTimes(1);
    expect(result.current.mode).toBe("select");

    act(() => {
      result.current.actions.initialize();
    });

    expect(result.current.mode).toBe("select");
    expect(result.current.viewer.props).toBeNull();
  });

  it("reports a persisted selection clearing failure", async () => {
    deleteStoredViewerSession.mockRejectedValueOnce(new Error("IndexedDB delete failed"));
    const actions = createActions();
    const service = createService();
    const { result } = renderHook(() => useSelectPanel({
      actions,
      service,
      selectionResetVersion: 1,
    }));

    await waitFor(() => {
      expect(result.current.uploadStatus).toEqual({ kind: "error", message: "Unable to clear selected document." });
    });
    expect(service.getErrorMessage).toHaveBeenCalledWith(expect.any(Error), "Unable to clear selected document.");
    expect(actions.showSelect).toHaveBeenCalledWith(
      "Select Document",
      "Drag and drop a PDF or multi-page TIFF, or select a file to begin.",
    );
  });

  it("does not restore a cleared lens when reset races with session restoration", async () => {
    const actions = createActions();
    const service = createService();
    const restore = deferred<boolean>();
    const viewer = createViewerApi(true);
    viewer.restoreSession = vi.fn(() => restore.promise);
    const { result, rerender } = renderHook(
      ({ selectionResetVersion }) => useSelectPanel({
        actions,
        service,
        selectionResetVersion,
      }),
      { initialProps: { selectionResetVersion: 0 } },
    );

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    act(() => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });

    await waitFor(() => {
      expect(viewer.restoreSession).toHaveBeenCalledTimes(1);
    });

    rerender({ selectionResetVersion: 1 });

    await waitFor(() => {
      expect(viewer.clear).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      restore.resolve(true);
      await restore.promise;
    });

    expect(service.setDocumentSelected).not.toHaveBeenCalledWith(true);
    expect(viewer.showThumbnails).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("select");
  });

  it("does not retain a decoded file when reset races with document analysis", async () => {
    const actions = createActions();
    const service = createService(false);
    const decode = deferred<void>();
    const viewer = createViewerApi(false);
    viewer.decodeDoc = vi.fn(() => decode.promise);
    const { result, rerender } = renderHook(
      ({ selectionResetVersion }) => useSelectPanel({
        actions,
        service,
        selectionResetVersion,
      }),
      { initialProps: { selectionResetVersion: 0 } },
    );

    let selectFile: Promise<void> = Promise.resolve();
    act(() => {
      selectFile = result.current.actions.selectFile(new File(["document"], "document.pdf", { type: "application/pdf" }));
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });

    act(() => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });

    await waitFor(() => {
      expect(viewer.decodeDoc).toHaveBeenCalledTimes(1);
    });

    rerender({ selectionResetVersion: 1 });

    await waitFor(() => {
      expect(viewer.clear).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      decode.resolve();
      await selectFile;
    });

    expect(service.setDocumentSelected).not.toHaveBeenCalledWith(true);
    expect(viewer.showThumbnails).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("select");
  });

  it("starts processing with the selected page count and document", async () => {
    const actions = createActions();
    const service = createService(false);
    const viewer = createViewerApi(false);
    const file = new File(["document"], "document.pdf", { type: "application/pdf" });
    const { result } = renderHook(() => useSelectPanel({ actions, service }));

    let selectFile: Promise<void> = Promise.resolve();
    act(() => {
      selectFile = result.current.actions.selectFile(file);
    });
    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
    });
    act(() => {
      result.current.viewer.props?.onApiReady?.(viewer);
      result.current.viewer.props?.onStateChange?.(createViewerState(3));
      result.current.viewer.props?.onStatusChange?.("ready");
    });
    await act(async () => {
      await selectFile;
    });
    await waitFor(() => {
      expect(result.current.review.startDisabled).toBe(false);
    });

    await act(async () => {
      await result.current.actions.start();
    });

    expect(service.start).toHaveBeenCalledWith(3, expect.any(Function));
    expect(viewer.exportTiff).not.toHaveBeenCalled();
  });
});
