import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateSelectFile } from "../service/selectFileHelper";
import { getSelectErrorMessage } from "../service/selectService";
import { clearViewerSession } from "../service/viewerSessionService";
import type {
  ErrorLike,
  SelectUploadStatus,
  ReviewDocumentLens,
  ReviewDocumentState,
  ReviewDocumentStatus,
  UseSelectPanelOptions,
  UseSelectPanelResult,
} from "../type/select.types";
import type { ViewerApi } from "../type/selectViewer.types";
import { isLensError, LENS_ERROR_PAGE_SIZE } from "@tabulariumai/aurora-lens";
import type { ExportProgress, PageSizeConfig, PageSizeFailure } from "@tabulariumai/aurora-lens";

const SELECT_COPY = {
  helper: "Drag and drop a PDF or multi-page TIFF, or select a file to begin.",
};

const REVIEW_COPY = {
  helper: "Review the document thumbnails. Add pages if needed, then start processing or cancel to choose another document.",
};

function getPageCount(state: ReviewDocumentState) {
  return typeof state?.pageCount === "number" ? state.pageCount : 0;
}

export function useSelectPanel(options: UseSelectPanelOptions): UseSelectPanelResult {
  const { pageSize, tiffPixelFormat, maxFileSizeBytes, actions, service, selectionResetVersion } = options;
  const lensRef = useRef<ReviewDocumentLens | null>(null);
  const sourceFileRef = useRef<File | null>(null);
  const sizeConfigRef = useRef(pageSize);
  const [sizeFailure, setSizeFailure] = useState<PageSizeFailure | null>(null);
  const loadIdRef = useRef(0);
  const selectionResetVersionRef = useRef(0);
  const startingRef = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<"select" | "review">("select");
  const [uploadStatus, setUploadStatus] = useState<SelectUploadStatus>({ kind: "idle" });
  const [viewerState, setViewerState] = useState<ReviewDocumentState>(null);
  const [viewerStatus, setViewerStatus] = useState<ReviewDocumentStatus>("idle");
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewerProps, setViewerProps] = useState<UseSelectPanelResult["viewer"]["props"]>(null);

  const disposeLens = useCallback(() => {
    loadIdRef.current += 1;
    lensRef.current?.close();
    lensRef.current = null;
    setViewerProps(null);
  }, []);

  const clearLens = useCallback(async () => {
    loadIdRef.current += 1;
    const lens = lensRef.current;
    lensRef.current = null;
    setViewerProps(null);
    if (lens) {
      await lens.clear();
      return;
    }
    await clearViewerSession();
  }, []);

  const resetReviewState = useCallback(() => {
    sourceFileRef.current = null;
    sizeConfigRef.current = pageSize;
    setSizeFailure(null);
    setViewerState(null);
    setViewerStatus("idle");
    startingRef.current = false;
    setStarting(false);
  }, [pageSize]);

  const resetStatus = useCallback(() => {
    setUploadStatus({ kind: "idle" });
  }, []);

  const showFailureMessage = useCallback((message: string) => {
    setMode("select");
    setUploadStatus({ kind: "error", message });
  }, []);

  const reportFailure = useCallback((error: unknown, message: string) => {
    if (isLensError(error) && error.code === LENS_ERROR_PAGE_SIZE && error.details && sourceFileRef.current) {
      setSizeFailure(error.details);
      setUploadStatus({ kind: "idle" });
      setViewerState(null);
      setViewerStatus("idle");
      setLoading(false);
      setMode("select");
      actions.showSelect(SELECT_COPY.helper);
      service.setDocumentSelected(false);
      return;
    }
    showFailureMessage(message);
  }, [actions, service, showFailureMessage]);

  const createViewer = useCallback((loadId: number, pageSize: PageSizeConfig): ReviewDocumentLens => {
    let viewerApi: ViewerApi | null = null;
    let release: "clear" | "close" | null = null;
    let resolveViewerApi!: (api: ViewerApi) => void;
    let rejectViewerApi!: (error: unknown) => void;
    const viewerApiReady = new Promise<ViewerApi>((resolve, reject) => {
      resolveViewerApi = resolve;
      rejectViewerApi = reject;
    });

    const releaseViewer = (nextRelease: "clear" | "close") => {
      if (release !== null) return false;
      release = nextRelease;
      rejectViewerApi(new Error("Aurora Lens is no longer available."));
      setViewerProps(null);
      return true;
    };

    setViewerProps({
      pageSize,
      allowEdit: true,
      onAddError(error: ErrorLike) {
        if (loadId !== loadIdRef.current) return;
        showFailureMessage(typeof error.message === "string" ? error.message : "Some pages could not be added.");
      },
      async onApiReady(api) {
        if (api === null) return;
        viewerApi = api;
        if (release !== null || loadId !== loadIdRef.current) {
          api.close();
          return;
        }
        try {
          const config = await api.readViewerConfig();
          if (release !== null || loadId !== loadIdRef.current) return;
          config.export.tiff.pixelFormat = tiffPixelFormat;
          await api.saveViewerConfig(config);
          if (release !== null || loadId !== loadIdRef.current) return;
          resolveViewerApi(api);
        } catch (error) {
          rejectViewerApi(error);
        }
      },
      onError(error: ErrorLike) {
        if (loadId !== loadIdRef.current) return;
        reportFailure(error, typeof error.message === "string" ? error.message : "Document could not be loaded.");
      },
      onStateChange(state) {
        if (loadId !== loadIdRef.current) return;
        setViewerState(state);
      },
      onStatusChange(status) {
        if (loadId !== loadIdRef.current) return;
        setViewerStatus(status);
      },
    });

    return {
      async clear() {
        if (!releaseViewer("clear")) return;
        if (viewerApi) {
          viewerApi.clear();
          return;
        }
        await clearViewerSession();
      },
      decodeDoc(file, decodeOptions) {
        return viewerApiReady.then((api) => api.decodeDoc(file, decodeOptions));
      },
      restoreSession() {
        return viewerApiReady.then((api) => api.restoreSession());
      },
      hasChanges() {
        return viewerApi !== null && viewerApi.isDirty();
      },
      exportTiff(onProgress) {
        return viewerApiReady.then((api) => api.exportTiff(onProgress));
      },
      showThumbnails() {
        return viewerApiReady.then((api) => api.showThumbnails());
      },
      close() {
        if (!releaseViewer("close")) return;
        viewerApi?.close();
      },
    };
  }, [reportFailure, showFailureMessage, tiffPixelFormat]);

  const mountSelectForm = useCallback(() => {
    resetReviewState();
    service.setDocumentSelected(false);
    disposeLens();
    setLoading(false);
    actions.showSelect(SELECT_COPY.helper);
    setMode("select");
  }, [actions, disposeLens, resetReviewState, service]);

  const mountViewer = useCallback(() => {
    actions.showSelect(REVIEW_COPY.helper);
    void lensRef.current?.showThumbnails();
    setMode("review");
  }, [actions]);

  const restoreViewer = useCallback(async () => {
    disposeLens();
    sourceFileRef.current = null;
    sizeConfigRef.current = pageSize;
    setSizeFailure(null);
    setViewerState(null);
    setViewerStatus("loadingPage");
    setStarting(false);
    actions.showSelect(REVIEW_COPY.helper);
    setLoading(true);

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    try {
      const lens = createViewer(loadId, sizeConfigRef.current);
      lensRef.current = lens;
      setMode("review");
      const restored = await lens.restoreSession();
      if (loadId !== loadIdRef.current) return;
      if (!restored) {
        mountSelectForm();
        return;
      }
      lens.showThumbnails();
      service.setDocumentSelected(true);
      setMode("review");
      setLoading(false);
    } catch {
      if (loadId !== loadIdRef.current) return;
      mountSelectForm();
    }
  }, [actions, createViewer, disposeLens, mountSelectForm, pageSize, service]);

  const initialize = useCallback(() => {
    setInitialized(true);
    if (service.isDocumentSelected() && lensRef.current) {
      mountViewer();
    } else if (service.isDocumentSelected()) {
      void restoreViewer();
    } else {
      mountSelectForm();
    }
  }, [mountSelectForm, mountViewer, restoreViewer, service]);

  const clear = useCallback(() => {
    service.clear();
    disposeLens();
    setLoading(false);
    resetReviewState();
    setUploadStatus({ kind: "idle" });
    setMode("select");
    setInitialized(false);
  }, [disposeLens, resetReviewState, service]);

  const resetForNewSession = useCallback(async () => {
    service.clear();
    setLoading(false);
    resetReviewState();
    setUploadStatus({ kind: "idle" });
    actions.showSelect(SELECT_COPY.helper);
    setMode("select");
    setInitialized(true);
    try {
      await clearLens();
    } catch (error) {
      const message = getSelectErrorMessage(error, "Unable to clear selected document.");
      console.error("Selection reset error:", message, error);
      showFailureMessage(message);
    }
  }, [actions, clearLens, resetReviewState, service, showFailureMessage]);

  const loadFile = useCallback(async (file: File, config: PageSizeConfig) => {
    sizeConfigRef.current = config;
    setSizeFailure(null);
    sourceFileRef.current = file;
    setViewerState(null);
    setViewerStatus("loadingPage");
    setStarting(false);
    setUploadStatus({ kind: "idle" });
    setMode("review");
    actions.showSelect(REVIEW_COPY.helper);
    disposeLens();
    setLoading(true);

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    try {
      const lens = createViewer(loadId, sizeConfigRef.current);
      lensRef.current = lens;
      await lens.decodeDoc(file, { page: 1, viewMode: "thumbnails" });
      if (loadId !== loadIdRef.current) return;
      service.setDocumentSelected(true);
      setMode("review");
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      const message = getSelectErrorMessage(error, "An error occurred while analyzing document.");
      if (!isLensError(error) || error.code !== LENS_ERROR_PAGE_SIZE) console.error("Selection analysis error:", message, error);
      reportFailure(error, message);
      service.setDocumentSelected(false);
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [actions, createViewer, disposeLens, reportFailure, service]);

  const selectFile = useCallback(async (file: File) => {
    const failure = validateSelectFile(file, maxFileSizeBytes);
    if (failure) {
      setUploadStatus({
        kind: "error",
        message: failure === "format" ? "Unsupported file format." : `File too large. Maximum ${maxFileSizeBytes / (1024 * 1024)}MB.`,
      });
      return;
    }

    await loadFile(file, pageSize);
  }, [loadFile, maxFileSizeBytes, pageSize]);

  const acceptSize = useCallback(async () => {
    const file = sourceFileRef.current;
    if (!file || !sizeFailure) return;
    await loadFile(file, { ...sizeConfigRef.current, tolerance: sizeFailure.requiredTolerance });
  }, [loadFile, sizeFailure]);

  const getFile = useCallback(async (onProgress: (progress: ExportProgress) => void) => {
    const lens = lensRef.current;
    if (!lens) {
      throw new Error("Aurora Lens is not ready.");
    }
    if (lens.hasChanges() || sourceFileRef.current === null) {
      const blob = await lens.exportTiff(onProgress);
      sourceFileRef.current = service.createTiffFile(blob);
    }
    return sourceFileRef.current;
  }, [service]);

  const start = useCallback(async () => {
    if (startingRef.current || viewerStatus !== "ready" || !getPageCount(viewerState)) {
      return;
    }
    startingRef.current = true;
    setStarting(true);
    actions.showProgress();
    const loadId = loadIdRef.current;

    try {
      await service.start(getPageCount(viewerState), getFile);
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      showFailureMessage(error instanceof Error ? error.message : String(error));
      console.error("Step1:", getSelectErrorMessage(error, "An error occurred while processing the document."), error);
      startingRef.current = false;
      setStarting(false);
    }
  }, [actions, getFile, showFailureMessage, viewerState, viewerStatus, service]);

  const cancel = useCallback(() => {
    mountSelectForm();
  }, [mountSelectForm]);

  const showSettings = useCallback(() => {
    service.showSettings();
  }, [service]);

  const refreshCancelConfirm = useCallback(() => {
    return Boolean(lensRef.current?.hasChanges());
  }, []);

  useEffect(() => () => {
    disposeLens();
  }, [disposeLens]);

  useEffect(() => {
    const resetVersion = selectionResetVersion ?? 0;
    if (resetVersion <= selectionResetVersionRef.current) return;
    selectionResetVersionRef.current = resetVersion;
    void resetForNewSession();
  }, [resetForNewSession, selectionResetVersion]);

  return useMemo(() => ({
    sizeFailure,
    mode: initialized ? mode : "pending",
    uploadStatus,
    loading,
    viewer: {
      visible: mode === "review" && viewerProps !== null,
      props: viewerProps,
    },
    review: {
      startDisabled: starting || viewerStatus !== "ready" || !getPageCount(viewerState),
      cancelDisabled: starting,
    },
    actions: {
      acceptSize,
      selectFile,
      start,
      showSettings,
      cancel,
      clear,
      initialize,
      resetStatus,
      refreshCancelConfirm,
    },
  }), [acceptSize, sizeFailure, cancel, clear, initialized, initialize, loading, mode, refreshCancelConfirm, resetStatus, selectFile, showSettings, start, starting, uploadStatus, viewerProps, viewerState, viewerStatus]);
}
