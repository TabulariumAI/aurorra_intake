import { pageSize } from "../../../test/pageSize";
import { act, renderHook, waitFor } from "@testing-library/react";
import { defaultViewerConfig, LensError, LENS_ERROR_PAGE_SIZE } from "@tabulariumai/aurora-lens";
import type { ViewerConfig, ViewerState } from "@tabulariumai/aurora-lens";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSelectPanel } from "../hook/useSelectPanel";
import type { IntakeContainerActions } from "../../intake/type/intake.types";
import type { SelectService } from "../type/select.types";
import type { ViewerApi } from "../type/selectViewer.types";
import { intakeActions } from "../../../store/state/intakeState";
import { storeApi, useStore } from "../../../store/state/store";

const deleteStoredViewerSession = vi.hoisted(() => vi.fn());

vi.mock("@tabulariumai/aurora-lens", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tabulariumai/aurora-lens")>(),
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
    showProgress: vi.fn(),
  };
}

function createService(documentSelected = true): SelectService {
  return {
    clear: vi.fn(),
    isDocumentSelected: vi.fn(() => documentSelected),
    setDocumentSelected: vi.fn(),
    start: vi.fn(async (_pageCount, getDocument) => {
      await getDocument(vi.fn());
    }),
    showSettings: vi.fn(),
    createTiffFile: vi.fn((blob) => new File([blob], "review.tiff", { type: "image/tiff" })),
  };
}

function createViewerApi(restored: boolean): ViewerApi {
  return {
    readViewerConfig: vi.fn(async () => defaultViewerConfig()),
    saveViewerConfig: vi.fn(async (config: ViewerConfig) => config),
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
  it.each([false, true])("unlocks selection after repeated clearSession(%s) calls on the mounted hook", async (preserveSettings) => {
    storeApi.getState().resetAllState();
    intakeActions.resetSelection();
    const service = createService(false);
    const actions = createActions();
    const { result } = renderHook(() => useSelectPanel({
      pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024,
      actions, service, selectionResetVersion: useStore((state) => state.selectionResetVersion),
    }));
    await waitFor(() => expect(result.current.mode).toBe("select"));
    for (let attempt = 0; attempt < 3; attempt++) {
      const viewer = createViewerApi(false);
      let selected!: Promise<void>;
      act(() => { selected = result.current.actions.selectFile(new File(["pdf"], "document.pdf", { type: "application/pdf" })); });
      await act(async () => {
        result.current.viewer.props?.onApiReady?.(viewer);
        result.current.viewer.props?.onStateChange?.(createViewerState(3));
        result.current.viewer.props?.onStatusChange?.("ready");
        await selected;
      });
      expect(result.current.review).toEqual({ startDisabled: false, cancelDisabled: false });
      await act(async () => { await result.current.actions.start(); });
      expect(result.current.review).toEqual({ startDisabled: true, cancelDisabled: true });
      act(() => intakeActions.clearSession(preserveSettings));
      await waitFor(() => expect(result.current.mode).toBe("select"));
      expect(result.current.viewer.props).toBeNull();
      expect(result.current.review).toEqual({ startDisabled: true, cancelDisabled: false });
      expect(viewer.clear).toHaveBeenCalledTimes(1);
    }
    expect(service.start).toHaveBeenCalledTimes(3);
  });

  it("replaces rejection errors, clears them for a valid selection, and resets them for a new session", async () => {
    const service = createService(false);
    const actions = createActions();
    const viewer = createViewerApi(false);
    const { result, rerender } = renderHook(({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service, selectionResetVersion }), { initialProps: { selectionResetVersion: 0 } });
    act(() => result.current.actions.initialize());
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); });
    await act(async () => result.current.actions.selectFile(new File(["text"], "document.txt")));
    expect(result.current.uploadStatus).toEqual({ kind: "error", message: "Unsupported file format." });
    const large = new File(["pdf"], "large.pdf");
    Object.defineProperty(large, "size", { value: 20 * 1024 * 1024 + 1 });
    await act(async () => result.current.actions.selectFile(large));
    expect(result.current.uploadStatus).toEqual({ kind: "error", message: "File too large. Maximum 20MB." });
    expect(viewer.decodeDoc).not.toHaveBeenCalled();
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });
    let selected!: Promise<void>;
    act(() => { selected = result.current.actions.selectFile(file); });
    expect(result.current.uploadStatus).toEqual({ kind: "idle" });
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); await selected; });
    expect(viewer.decodeDoc).toHaveBeenCalledWith(file, { page: 1, viewMode: "thumbnails" });
    await act(async () => result.current.actions.selectFile(new File(["text"], "another.txt")));
    expect(result.current.uploadStatus.kind).toBe("error");
    rerender({ selectionResetVersion: 1 });
    await waitFor(() => expect(result.current.uploadStatus).toEqual({ kind: "idle" }));
  });

  it.each(["bw1", "gray8", "rgb24"] as const)("applies %s before restoring without changing other settings", async (tiffPixelFormat) => {
    const config = defaultViewerConfig();
    config.view.pdfRasterDpi = 125;
    config.export.pdfRasterDpi = 225;
    config.export.tiff.compression = 8;
    const expected = structuredClone(config);
    expected.export.tiff.pixelFormat = tiffPixelFormat;
    const viewer = createViewerApi(true);
    vi.mocked(viewer.readViewerConfig).mockResolvedValue(config);
    const saved = deferred<typeof config>();
    vi.mocked(viewer.saveViewerConfig).mockReturnValue(saved.promise);
    const service = createService();
    const actions = createActions();
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat, maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));
    act(() => result.current.actions.initialize());
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); });
    expect(viewer.saveViewerConfig).toHaveBeenCalledWith(expected);
    expect(viewer.restoreSession).not.toHaveBeenCalled();
    await act(async () => { saved.resolve(expected); });
    expect(viewer.restoreSession).toHaveBeenCalledTimes(1);
    expect(viewer.decodeDoc).not.toHaveBeenCalled();
    act(() => result.current.actions.initialize());
    expect(viewer.saveViewerConfig).toHaveBeenCalledTimes(1);
    expect(viewer.restoreSession).toHaveBeenCalledTimes(1);
  });

  it("waits for configuration before decoding a new file", async () => {
    const viewer = createViewerApi(false);
    const config = deferred<Awaited<ReturnType<ViewerApi["readViewerConfig"]>>>();
    vi.mocked(viewer.readViewerConfig).mockReturnValue(config.promise);
    const actions = createActions();
    const service = createService(false);
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });
    let selected!: Promise<void>;
    act(() => { selected = result.current.actions.selectFile(file); });
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); });
    expect(viewer.saveViewerConfig).not.toHaveBeenCalled();
    expect(viewer.decodeDoc).not.toHaveBeenCalled();
    await act(async () => { config.resolve(defaultViewerConfig()); await selected; });
    expect(viewer.saveViewerConfig).toHaveBeenCalledWith(expect.objectContaining({ export: expect.objectContaining({ tiff: { compression: 5, pixelFormat: "gray8" } }) }));
    expect(viewer.decodeDoc).toHaveBeenCalledWith(file, { page: 1, viewMode: "thumbnails" });
    expect(vi.mocked(viewer.saveViewerConfig).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(viewer.decodeDoc).mock.invocationCallOrder[0]);
  });

  it.each(["readViewerConfig", "saveViewerConfig"] as const)("reports %s failure without decoding or exporting", async (method) => {
    const viewer = createViewerApi(false);
    vi.mocked(viewer[method]).mockRejectedValue(new Error("Configuration storage failed."));
    const actions = createActions();
    const service = createService(false);
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));
    let selected!: Promise<void>;
    act(() => { selected = result.current.actions.selectFile(new File(["pdf"], "source.pdf")); });
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); await selected; });
    expect(result.current.uploadStatus).toEqual({ kind: "error", message: "Configuration storage failed." });
    expect(viewer.decodeDoc).not.toHaveBeenCalled();
    expect(viewer.exportTiff).not.toHaveBeenCalled();
  });

  it.each([["read", "close"], ["save", "close"], ["read", "clear"], ["save", "clear"]] as const)("does not open a viewer released during configuration %s by %s", async (phase, release) => {
    const viewer = createViewerApi(true);
    const pending = deferred<Awaited<ReturnType<ViewerApi["readViewerConfig"]>>>();
    if (phase === "read") vi.mocked(viewer.readViewerConfig).mockReturnValue(pending.promise);
    else vi.mocked(viewer.saveViewerConfig).mockReturnValue(pending.promise);
    const actions = createActions();
    const service = createService();
    const { result, unmount, rerender } = renderHook(
      ({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service, selectionResetVersion }),
      { initialProps: { selectionResetVersion: 0 } },
    );
    act(() => result.current.actions.initialize());
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); });
    if (release === "close") unmount();
    else rerender({ selectionResetVersion: 1 });
    await act(async () => { pending.resolve(defaultViewerConfig()); });
    expect(viewer[release]).toHaveBeenCalledTimes(1);
    expect(viewer.restoreSession).not.toHaveBeenCalled();
    expect(viewer.decodeDoc).not.toHaveBeenCalled();
    if (phase === "read") expect(viewer.saveViewerConfig).not.toHaveBeenCalled();
  });

  it("reports loading without package progress presentation", async () => {
    const actions = createActions();
    const service = createService(false);
    const decode = deferred<void>();
    const viewer = createViewerApi(false);
    viewer.decodeDoc = vi.fn(() => decode.promise);
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));

    let selectFile: Promise<void> = Promise.resolve();
    act(() => {
      selectFile = result.current.actions.selectFile(new File(["document"], "document.pdf", { type: "application/pdf" }));
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
      expect(result.current.viewer.props).toMatchObject({ pageSize });
    });
    act(() => {
      result.current.viewer.props?.onApiReady?.(viewer);
    });
    await waitFor(() => {
      expect(viewer.decodeDoc).toHaveBeenCalledTimes(1);
      expect(viewer.decodeDoc).toHaveBeenCalledWith(expect.any(File), { page: 1, viewMode: "thumbnails" });
    });

    expect(result.current).toHaveProperty("loading", true);
    expect(result.current).not.toHaveProperty("progress");

    await act(async () => {
      decode.resolve();
      await selectFile;
    });

    expect(result.current).toHaveProperty("loading", false);
    expect(viewer.showThumbnails).not.toHaveBeenCalled();
    expect(service.setDocumentSelected).toHaveBeenCalledWith(true);
  });

  it("opens thumbnails after restoring and when returning to the selected document", async () => {
    const actions = createActions();
    const service = createService();
    const viewer = createViewerApi(true);
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));

    act(() => result.current.actions.initialize());
    await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); });
    expect(viewer.restoreSession).toHaveBeenCalledTimes(1);
    expect(viewer.showThumbnails).toHaveBeenCalledTimes(1);

    act(() => result.current.actions.initialize());
    await waitFor(() => expect(viewer.showThumbnails).toHaveBeenCalledTimes(2));
    expect(viewer.restoreSession).toHaveBeenCalledTimes(1);
    expect(viewer.decodeDoc).not.toHaveBeenCalled();
  });

  it("keeps pending restore viewer props when the service object changes", async () => {
    const actions = createActions();
    const firstService = createService();
    const secondService = createService();
    const { result, rerender } = renderHook(
      ({ service }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }),
      { initialProps: { service: firstService } },
    );

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
      expect(result.current.viewer.props).toMatchObject({ pageSize });
    });

    rerender({ service: secondService });

    expect(result.current.mode).toBe("review");
    expect(result.current.viewer.visible).toBe(true);
    expect(result.current.viewer.props).not.toBeNull();
  });

  it("returns to select mode when stored lens restore is unavailable", async () => {
    const actions = createActions();
    const service = createService();
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
      "Drag and drop a PDF or multi-page TIFF, or select a file to begin.",
    );
  });

  it("closes the restored Aurora Lens when the select panel unmounts", async () => {
    const actions = createActions();
    const service = createService();
    const viewer = createViewerApi(true);
    const { result, unmount } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));

    act(() => {
      result.current.actions.initialize();
    });

    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
      ({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024,
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
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024,
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
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024,
      actions,
      service,
      selectionResetVersion: 1,
    }));

    await waitFor(() => {
      expect(result.current.uploadStatus).toEqual({ kind: "error", message: "IndexedDB delete failed" });
    });
    expect(actions.showSelect).toHaveBeenCalledWith(
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
      ({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024,
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
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
      ({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024,
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
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));

    let selectFile: Promise<void> = Promise.resolve();
    act(() => {
      selectFile = result.current.actions.selectFile(file);
    });
    await waitFor(() => {
      expect(result.current.viewer.props).not.toBeNull();
      expect(result.current.viewer.props).toMatchObject({ pageSize });
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
    expect(actions.showProgress).toHaveBeenCalledTimes(1);
  });

  it.each(["edited", "restored"])("shows progress and retains the %s viewer while export is pending", async (source) => {
    const actions = createActions();
    const service = createService(source === "restored");
    const viewer = createViewerApi(true);
    const exported = deferred<Blob>();
    viewer.isDirty = vi.fn(() => source === "edited");
    viewer.exportTiff = vi.fn(() => exported.promise);
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));
    act(() => result.current.actions.initialize());
    let selected: Promise<void> | undefined;
    if (source === "edited") {
      act(() => { selected = result.current.actions.selectFile(new File(["pdf"], "document.pdf")); });
    }
    await act(async () => {
      result.current.viewer.props?.onApiReady?.(viewer);
      result.current.viewer.props?.onStateChange?.(createViewerState(2));
      result.current.viewer.props?.onStatusChange?.("ready");
      await selected;
    });
    const props = result.current.viewer.props;
    let started: Promise<void>;
    act(() => { started = result.current.actions.start(); });
    await waitFor(() => expect(viewer.exportTiff).toHaveBeenCalledTimes(1));
    expect(actions.showProgress).toHaveBeenCalledTimes(1);
    expect(vi.mocked(actions.showProgress).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(viewer.exportTiff).mock.invocationCallOrder[0]);
    expect(result.current.viewer.props).toBe(props);
    expect(result.current.mode).toBe("review");
    expect(viewer.exportTiff).toHaveBeenCalledWith(expect.any(Function));
    expect(result.current.review).toEqual({ startDisabled: true, cancelDisabled: true });
    expect(viewer.close).not.toHaveBeenCalled();
    await act(async () => { await result.current.actions.start(); });
    expect(service.start).toHaveBeenCalledTimes(1);
    const blob = new Blob(["tiff"], { type: "image/tiff" });
    await act(async () => { exported.resolve(blob); await started; });
    expect(service.createTiffFile).toHaveBeenCalledWith(blob);
    expect(actions.showProgress).toHaveBeenCalledTimes(1);
  });

  it("does not show progress or start before the viewer has ready pages", async () => {
    const actions = createActions();
    const service = createService();
    const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));
    act(() => result.current.actions.initialize());
    await act(async () => { result.current.viewer.props?.onApiReady?.(createViewerApi(true)); });
    await act(async () => { await result.current.actions.start(); });
    act(() => {
      result.current.viewer.props?.onStatusChange?.("ready");
      result.current.viewer.props?.onStateChange?.(createViewerState(0));
    });
    await act(async () => { await result.current.actions.start(); });
    expect(actions.showProgress).not.toHaveBeenCalled();
    expect(service.start).not.toHaveBeenCalled();
  });

  it("keeps the reset selection clean when its previous export is aborted", async () => {
    const actions = createActions();
    const service = createService();
    const viewer = createViewerApi(true);
    let reject!: (error: Error) => void;
    viewer.exportTiff = vi.fn(() => new Promise<Blob>((_resolve, fail) => { reject = fail; }));
    viewer.clear = vi.fn(() => { reject(new DOMException("TIFF export closed.", "AbortError")); });
    const { result, rerender } = renderHook(({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service, selectionResetVersion }), { initialProps: { selectionResetVersion: 0 } });
    act(() => result.current.actions.initialize());
    await act(async () => {
      result.current.viewer.props?.onApiReady?.(viewer);
      result.current.viewer.props?.onStateChange?.(createViewerState(2));
      result.current.viewer.props?.onStatusChange?.("ready");
    });
    let started!: Promise<void>;
    act(() => { started = result.current.actions.start(); });
    await waitFor(() => expect(viewer.exportTiff).toHaveBeenCalledTimes(1));
    rerender({ selectionResetVersion: 1 });
    await act(async () => { await started; });
    expect(result.current.mode).toBe("select");
    expect(result.current.uploadStatus).toEqual({ kind: "idle" });
    expect(viewer.clear).toHaveBeenCalledTimes(1);
  });
});


const sizeDetails = {
  sourceName: "16859820.pdf", pageNumber: 1, width: 1275, height: 1739,
  tolerance: 0.02, requiredTolerance: 0.035,
};

it.each(["decode", "background"])("offers a scoped retry for a %s page-size rejection", async (phase) => {
  const service = createService(false);
  const file = new File(["document"], sizeDetails.sourceName, { type: "application/pdf" });
  const viewer = createViewerApi(false);
  const actions = createActions();
  const error = new LensError(LENS_ERROR_PAGE_SIZE, "Page rejected", sizeDetails);
  if (phase === "decode") viewer.decodeDoc = vi.fn().mockRejectedValue(error);
  const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions, service }));
  act(() => result.current.actions.initialize());
  let selected!: Promise<void>;
  act(() => { selected = result.current.actions.selectFile(file); });
  const previousProps = result.current.viewer.props!;
  await act(async () => { previousProps.onApiReady?.(viewer); await selected; });
  if (phase === "background") act(() => previousProps.onError?.(error));
  expect(result.current.sizeFailure).toEqual(sizeDetails);
  expect(actions.showSelect).toHaveBeenLastCalledWith("Drag and drop a PDF or multi-page TIFF, or select a file to begin.");
  expect(result.current.uploadStatus).toEqual({ kind: "idle" });
  expect(result.current.loading).toBe(false);
  expect(result.current.review.startDisabled).toBe(true);
  expect(service.start).not.toHaveBeenCalled();
  expect(service.setDocumentSelected).toHaveBeenLastCalledWith(false);
  let retry!: Promise<void>;
  act(() => { retry = result.current.actions.acceptSize(); });
  expect(result.current.sizeFailure).toBeNull();
  expect(result.current.viewer.props?.pageSize).toEqual({ ...pageSize, tolerance: sizeDetails.requiredTolerance });
  const accepted = createViewerApi(false);
  await act(async () => {
    result.current.viewer.props?.onApiReady?.(accepted);
    result.current.viewer.props?.onStateChange?.(createViewerState(2));
    result.current.viewer.props?.onStatusChange?.("ready");
    await retry;
  });
  expect(accepted.decodeDoc).toHaveBeenCalledWith(file, { page: 1, viewMode: "thumbnails" });
  expect(pageSize.tolerance).toBe(0.02);
  await act(async () => { await result.current.actions.start(); });
  expect(service.start).toHaveBeenCalledWith(2, expect.any(Function));
  expect(accepted.exportTiff).not.toHaveBeenCalled();
  // A later page can require its own explicit confirmation.
  act(() => result.current.viewer.props?.onError?.(new LensError(LENS_ERROR_PAGE_SIZE, "Later page", { ...sizeDetails, pageNumber: 2, tolerance: 0.035, requiredTolerance: 0.05 })));
  expect(result.current.sizeFailure).toMatchObject({ pageNumber: 2, tolerance: 0.035, requiredTolerance: 0.05 });
});

it.each(["cancel", "clear", "reset", "select"] as const)("clears the page-size prompt and override on %s", async (action) => {
  const service = createService(false);
  const { result, rerender } = renderHook(({ selectionResetVersion }) => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions: createActions(), service, selectionResetVersion }), { initialProps: { selectionResetVersion: 0 } });
  const file = new File(["document"], sizeDetails.sourceName, { type: "application/pdf" });
  act(() => result.current.actions.initialize());
  let selected!: Promise<void>;
  act(() => { selected = result.current.actions.selectFile(file); });
  const rejected = createViewerApi(false);
  rejected.decodeDoc = vi.fn().mockRejectedValue(new LensError(LENS_ERROR_PAGE_SIZE, "Rejected", sizeDetails));
  await act(async () => { result.current.viewer.props?.onApiReady?.(rejected); await selected; });
  const staleError = result.current.viewer.props?.onError;
  let retry!: Promise<void>;
  act(() => { retry = result.current.actions.acceptSize(); });
  await act(async () => { result.current.viewer.props?.onApiReady?.(createViewerApi(false)); await retry; });
  if (action === "reset") rerender({ selectionResetVersion: 1 });
  else if (action !== "select") act(() => result.current.actions[action]());
  await waitFor(() => expect(result.current.sizeFailure).toBeNull());
  act(() => { selected = result.current.actions.selectFile(new File(["next"], "next.pdf", { type: "application/pdf" })); });
  expect(result.current.viewer.props?.pageSize).toEqual(pageSize);
  act(() => staleError?.(new LensError(LENS_ERROR_PAGE_SIZE, "Stale", sizeDetails)));
  expect(result.current.sizeFailure).toBeNull();
  await act(async () => { result.current.viewer.props?.onApiReady?.(createViewerApi(false)); await selected; });
});

it("cancels a rejected selection without retrying or retaining a stale confirmation", async () => {
  const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions: createActions(), service: createService(false) }));
  act(() => result.current.actions.initialize());
  let selected!: Promise<void>;
  act(() => { selected = result.current.actions.selectFile(new File(["pdf"], sizeDetails.sourceName)); });
  const viewer = createViewerApi(false);
  viewer.decodeDoc = vi.fn().mockRejectedValue(new LensError(LENS_ERROR_PAGE_SIZE, "Rejected", sizeDetails));
  await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); await selected; });
  const accept = result.current.actions.acceptSize;
  act(() => result.current.actions.cancel());
  await act(async () => { await accept(); });
  expect(result.current.sizeFailure).toBeNull();
  expect(result.current.mode).toBe("select");
  expect(result.current.viewer.props).toBeNull();
  expect(viewer.decodeDoc).toHaveBeenCalledTimes(1);
});

it("keeps ordinary decode and add-page failures on the existing error path", async () => {
  const { result } = renderHook(() => useSelectPanel({ pageSize, tiffPixelFormat: "gray8", maxFileSizeBytes: 20 * 1024 * 1024, actions: createActions(), service: createService(false) }));
  act(() => result.current.actions.initialize());
  let selected!: Promise<void>;
  act(() => { selected = result.current.actions.selectFile(new File(["pdf"], "broken.pdf")); });
  const viewer = createViewerApi(false);
  viewer.decodeDoc = vi.fn().mockRejectedValue(new Error("Unreadable PDF"));
  await act(async () => { result.current.viewer.props?.onApiReady?.(viewer); await selected; });
  expect(result.current.uploadStatus).toEqual({ kind: "error", message: "Unreadable PDF" });
  expect(result.current.sizeFailure).toBeNull();
  act(() => result.current.viewer.props?.onAddError?.(new LensError(LENS_ERROR_PAGE_SIZE, "Added page rejected", sizeDetails)));
  expect(result.current.uploadStatus).toEqual({ kind: "error", message: "Added page rejected" });
  expect(result.current.sizeFailure).toBeNull();
});
