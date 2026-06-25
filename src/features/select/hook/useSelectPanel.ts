import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateSelectFile } from "../service/selectFileHelper";
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
  const { actions, service } = options;
  const lensRef = useRef<ReviewDocumentLens | null>(null);
  const viewerApiRef = useRef<ViewerApi | null>(null);
  const resolveViewerApiRef = useRef<(api: ViewerApi) => void>(() => undefined);
  const sourceFileRef = useRef<File | null>(null);
  const loadIdRef = useRef(0);
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

  const waitForViewerApi = useCallback(() => {
    if (viewerApiRef.current) return Promise.resolve(viewerApiRef.current);
    return new Promise<ViewerApi>((resolve) => {
      resolveViewerApiRef.current = resolve;
    });
  }, []);

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
    viewerApiRef.current = null;
    resolveViewerApiRef.current = () => undefined;
    setViewerProps(null);
    setCancelNeedsConfirm(false);
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
    viewerApiRef.current = null;
    setViewerProps({
      allowEdit: true,
      onAddError(error: ErrorLike) {
        if (loadId !== loadIdRef.current) return;
        showFailureMessage(typeof error.message === "string" ? error.message : "Some pages could not be added.");
      },
      onApiReady(api) {
        viewerApiRef.current = api;
        if (api) {
          resolveViewerApiRef.current(api);
        }
      },
      onError(error: ErrorLike) {
        if (loadId !== loadIdRef.current) return;
        service.emitProgressStop();
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
      decodeDoc(file, decodeOptions) {
        return waitForViewerApi().then((api) => api.decodeDoc(file, decodeOptions));
      },
      restoreSession() {
        return waitForViewerApi().then((api) => api.restoreSession());
      },
      hasChanges() {
        return typeof viewerApiRef.current?.isDirty === "function" ? viewerApiRef.current.isDirty() : false;
      },
      exportTiff() {
        return waitForViewerApi().then((api) => api.exportTiff());
      },
      showThumbnails() {
        return waitForViewerApi().then((api) => api.showThumbnails());
      },
      close() {
        viewerApiRef.current?.close();
        viewerApiRef.current = null;
        setViewerProps(null);
      },
    };
  }, [actions, service, showFailureMessage, waitForViewerApi]);

  const mountSelectForm = useCallback(() => {
    resetReviewState();
    service.setDocumentSelected(false);
    disposeLens();
    disposeProgress();
    actions.showSelect(SELECT_COPY.title, SELECT_COPY.helper);
    service.emitProgressStop();
    setMode("select");
  }, [actions, disposeLens, disposeProgress, resetReviewState, service]);

  const mountViewer = useCallback(() => {
    actions.showSelect(REVIEW_COPY.title, REVIEW_COPY.helper);
    void lensRef.current?.showThumbnails();
    setMode("review");
  }, [actions]);

  const restoreViewer = useCallback(async () => {
    service.emitProgressStop();
    disposeLens();
    disposeProgress();
    sourceFileRef.current = null;
    setViewerState(null);
    setViewerStatus("loadingPage");
    setStarting(false);
    actions.showSelect(REVIEW_COPY.title, REVIEW_COPY.helper);
    setMode("review");
    showProgress(false);

    try {
      const loadId = loadIdRef.current + 1;
      loadIdRef.current = loadId;
      const lens = createViewer(loadId);
      const restored = await lens.restoreSession();
      if (!restored) {
        mountSelectForm();
        return;
      }
      lens.showThumbnails();
      service.setDocumentSelected(true);
      lensRef.current = lens;
      setCancelNeedsConfirm(lens.hasChanges());
      setMode("review");
      disposeProgress();
    } catch {
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

    try {
      const loadId = loadIdRef.current + 1;
      loadIdRef.current = loadId;
      const lens = createViewer(loadId);
      await lens.decodeDoc(file, { page: 0, viewMode: "thumbnails" });
      lens.showThumbnails();
      lensRef.current = lens;
      setCancelNeedsConfirm(lens.hasChanges());
      service.setDocumentSelected(true);
      setMode("review");
    } catch (error) {
      const message = service.getErrorMessage(error, "An error occurred while analyzing document.");
      console.error("Selection analysis error:", message);
      showFailureMessage(message);
      service.emitProgressStop();
      service.setDocumentSelected(false);
    } finally {
      disposeProgress();
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
      service.emitProgressStop();
      service.emitProgressStart();
      service.setPageCount(getPageCount(viewerState));
      const document = await getFile();
      if (!document) {
        throw new Error("Failed to get the selected file.");
      }
      await service.emitRoute(document);
    } catch (error) {
      showFailureMessage(error instanceof Error ? error.message : String(error));
      console.error("Step1:", service.getErrorMessage(error, "An error occurred while processing the document."));
      service.emitProgressStop();
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
    disposeProgress();
  }, [disposeLens, disposeProgress]);

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
