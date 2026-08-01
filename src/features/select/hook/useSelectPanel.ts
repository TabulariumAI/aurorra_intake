import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateSelectFile } from "../service/selectFileHelper";
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

const SELECT_COPY = {
  title: "Select Document",
  helper: "Drag and drop a PDF or multi-page TIFF, or select a file to begin.",
};

const REVIEW_COPY = {
  title: "Review Document",
  helper: "Review the document thumbnails. Add pages if needed, then start processing or cancel to choose another document.",
};

function getPageCount(state: ReviewDocumentState) {
  return typeof state?.pageCount === "number" ? state.pageCount : 0;
}

export function useSelectPanel(options: UseSelectPanelOptions): UseSelectPanelResult {
  const { actions, service, selectionResetVersion } = options;
  const lensRef = useRef<ReviewDocumentLens | null>(null);
  const sourceFileRef = useRef<File | null>(null);
  const loadIdRef = useRef(0);
  const selectionResetVersionRef = useRef(0);
  const startingRef = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<"select" | "review">("select");
  const [uploadStatus, setUploadStatus] = useState<SelectUploadStatus>({ kind: "idle" });
  const [viewerState, setViewerState] = useState<ReviewDocumentState>(null);
  const [viewerStatus, setViewerStatus] = useState<ReviewDocumentStatus>("idle");
  const [cancelNeedsConfirm, setCancelNeedsConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState({
    visible: false,
    showText: false,
    durationMs: service.getProgressIntervalMs(),
  });
  const [viewerProps, setViewerProps] = useState<UseSelectPanelResult["viewer"]["props"]>(null);

  const disposeProgress = useCallback(() => {
    setProgress({
      visible: false,
      showText: false,
      durationMs: service.getProgressIntervalMs(),
    });
  }, [service]);

  const showProgress = useCallback((showText: boolean) => {
    setProgress({
      visible: true,
      showText,
      durationMs: service.getProgressIntervalMs(),
    });
  }, [service]);

  const disposeLens = useCallback(() => {
    loadIdRef.current += 1;
    lensRef.current?.close();
    lensRef.current = null;
    setViewerProps(null);
    setCancelNeedsConfirm(false);
  }, []);

  const clearLens = useCallback(async () => {
    loadIdRef.current += 1;
    const lens = lensRef.current;
    lensRef.current = null;
    setViewerProps(null);
    setCancelNeedsConfirm(false);
    if (lens) {
      await lens.clear();
      return;
    }
    await clearViewerSession();
  }, []);

  const resetReviewState = useCallback(() => {
    sourceFileRef.current = null;
    setViewerState(null);
    setViewerStatus("idle");
    startingRef.current = false;
    setStarting(false);
  }, []);

  const resetStatus = useCallback(() => {
    setUploadStatus({ kind: "idle" });
  }, []);

  const showFailureMessage = useCallback((message: string) => {
    setMode("select");
    setUploadStatus({ kind: "error", message });
  }, []);

  const createViewer = useCallback((loadId: number): ReviewDocumentLens => {
    let viewerApi: ViewerApi | null = null;
    let release: "clear" | "close" | null = null;
    let resolveViewerApi: (api: ViewerApi) => void = () => undefined;
    let rejectViewerApi: (error: Error) => void = () => undefined;
    const viewerApiReady = new Promise<ViewerApi>((resolve, reject) => {
      resolveViewerApi = resolve;
      rejectViewerApi = reject;
    });

    const waitForViewerApi = () => viewerApi ? Promise.resolve(viewerApi) : viewerApiReady;
    const releaseViewer = (nextRelease: "clear" | "close") => {
      if (release !== null) return false;
      release = nextRelease;
      rejectViewerApi(new Error("Aurora Lens is no longer available."));
      setViewerProps(null);
      return true;
    };
    const clearViewer = async () => {
      if (!releaseViewer("clear")) return;
      if (viewerApi) {
        viewerApi.clear();
        return;
      }
      await clearViewerSession();
    };
    const closeViewer = () => {
      if (!releaseViewer("close")) return;
      viewerApi?.close();
    };

    setViewerProps({
      allowEdit: true,
      onAddError(error: ErrorLike) {
        if (loadId !== loadIdRef.current) return;
        showFailureMessage(typeof error.message === "string" ? error.message : "Some pages could not be added.");
      },
      onApiReady(api) {
        if (api === null) return;
        viewerApi = api;
        if (release === "clear") {
          api.close();
          return;
        }
        if (release === "close" || loadId !== loadIdRef.current) {
          api.close();
          return;
        }
        resolveViewerApi(api);
      },
      onError(error: ErrorLike) {
        if (loadId !== loadIdRef.current) return;
        showFailureMessage(typeof error.message === "string" ? error.message : "Document could not be loaded.");
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
      clear() {
        return clearViewer();
      },
      decodeDoc(file, decodeOptions) {
        return waitForViewerApi().then((api) => api.decodeDoc(file, decodeOptions));
      },
      restoreSession() {
        return waitForViewerApi().then((api) => api.restoreSession());
      },
      hasChanges() {
        return typeof viewerApi?.isDirty === "function" ? viewerApi.isDirty() : false;
      },
      exportTiff() {
        return waitForViewerApi().then((api) => api.exportTiff());
      },
      showThumbnails() {
        return waitForViewerApi().then((api) => api.showThumbnails());
      },
      close() {
        closeViewer();
      },
    };
  }, [showFailureMessage]);

  const mountSelectForm = useCallback(() => {
    resetReviewState();
    service.setDocumentSelected(false);
    disposeLens();
    disposeProgress();
    actions.showSelect(SELECT_COPY.title, SELECT_COPY.helper);
    setMode("select");
  }, [actions, disposeLens, disposeProgress, resetReviewState, service]);

  const mountViewer = useCallback(() => {
    actions.showSelect(REVIEW_COPY.title, REVIEW_COPY.helper);
    void lensRef.current?.showThumbnails();
    setMode("review");
  }, [actions]);

  const restoreViewer = useCallback(async () => {
    disposeLens();
    disposeProgress();
    sourceFileRef.current = null;
    setViewerState(null);
    setViewerStatus("loadingPage");
    setStarting(false);
    actions.showSelect(REVIEW_COPY.title, REVIEW_COPY.helper);
    showProgress(false);

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    try {
      const lens = createViewer(loadId);
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
      setCancelNeedsConfirm(lens.hasChanges());
      setMode("review");
      disposeProgress();
    } catch {
      if (loadId !== loadIdRef.current) return;
      mountSelectForm();
    }
  }, [actions, createViewer, disposeLens, disposeProgress, mountSelectForm, service, showProgress]);

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
    disposeProgress();
    sourceFileRef.current = null;
    setViewerState(null);
    setViewerStatus("idle");
    setStarting(false);
    startingRef.current = false;
    setUploadStatus({ kind: "idle" });
    setMode("select");
    setInitialized(false);
  }, [disposeLens, disposeProgress, service]);

  const resetForNewSession = useCallback(async () => {
    service.clear();
    disposeProgress();
    resetReviewState();
    setUploadStatus({ kind: "idle" });
    actions.showSelect(SELECT_COPY.title, SELECT_COPY.helper);
    setMode("select");
    setInitialized(true);
    try {
      await clearLens();
    } catch (error) {
      const message = service.getErrorMessage(error, "Unable to clear selected document.");
      console.error("Selection reset error:", message);
      showFailureMessage(message);
    }
  }, [actions, clearLens, disposeProgress, resetReviewState, service, showFailureMessage]);

  const selectFile = useCallback(async (file: File) => {
    const failure = validateSelectFile(file);
    if (failure) {
      setUploadStatus({
        kind: "error",
        message: failure === "format" ? "Unsupported file format." : "File too large. Maximum 10MB.",
      });
      return;
    }

    sourceFileRef.current = file;
    setViewerState(null);
    setViewerStatus("loadingPage");
    setStarting(false);
    setUploadStatus({ kind: "idle" });
    setMode("review");
    actions.showSelect(REVIEW_COPY.title, REVIEW_COPY.helper);
    disposeLens();
    disposeProgress();
    showProgress(true);

    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    try {
      const lens = createViewer(loadId);
      lensRef.current = lens;
      await lens.decodeDoc(file, { page: 0, viewMode: "thumbnails" });
      if (loadId !== loadIdRef.current) return;
      lens.showThumbnails();
      setCancelNeedsConfirm(lens.hasChanges());
      service.setDocumentSelected(true);
      setMode("review");
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      const message = service.getErrorMessage(error, "An error occurred while analyzing document.");
      console.error("Selection analysis error:", message);
      showFailureMessage(message);
      service.setDocumentSelected(false);
    } finally {
      if (loadId === loadIdRef.current) {
        disposeProgress();
      }
    }
  }, [actions, createViewer, disposeLens, disposeProgress, showFailureMessage, service, showProgress]);

  const getFile = useCallback(async () => {
    const lens = lensRef.current;
    if (!lens) {
      throw new Error("Aurora Lens is not ready.");
    }
    if (lens.hasChanges() || sourceFileRef.current === null) {
      const blob = await lens.exportTiff();
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

    try {
      await service.start(getPageCount(viewerState), getFile);
    } catch (error) {
      showFailureMessage(error instanceof Error ? error.message : String(error));
      console.error("Step1:", service.getErrorMessage(error, "An error occurred while processing the document."));
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
    const needsConfirm = Boolean(lensRef.current?.hasChanges());
    setCancelNeedsConfirm(needsConfirm);
    return needsConfirm;
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
    mode: initialized ? mode : "pending",
    uploadStatus,
    progress,
    viewer: {
      visible: mode === "review" && viewerProps !== null,
      props: viewerProps,
    },
    review: {
      startDisabled: starting || viewerStatus !== "ready" || !getPageCount(viewerState),
      cancelDisabled: starting,
      cancelNeedsConfirm,
    },
    actions: {
      selectFile,
      start,
      showSettings,
      cancel,
      clear,
      initialize,
      resetStatus,
      refreshCancelConfirm,
    },
  }), [cancel, cancelNeedsConfirm, clear, initialized, initialize, mode, progress, refreshCancelConfirm, resetStatus, selectFile, showSettings, start, starting, uploadStatus, viewerProps, viewerState, viewerStatus]);
}
