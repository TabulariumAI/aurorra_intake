import { useLayoutEffect, useRef, useState } from "react";
import { AuroraLens, IndexedDbViewerSessionStore } from "@tabulariumai/aurora-lens";
import type { ViewerState, ViewerStatus } from "@tabulariumai/aurora-lens";
import type { ViewerApi, SelectViewerProps } from "../type/selectViewer.types";

function requireViewer(viewerRef: { current: ViewerApi | null }) {
  const viewer = viewerRef.current;
  if (viewer === null) {
    throw new Error("SelectViewer is not initialized.");
  }
  return viewer;
}

export function useSelectViewer({
  allowEdit = false,
  onAddError,
  onError,
  onStateChange,
  onStatusChange,
  onApiReady,
}: SelectViewerProps) {
  const lensHostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ViewerApi | null>(null);
  const [state, setState] = useState<ViewerState | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");

  useLayoutEffect(() => {
    const lensHost = lensHostRef.current;
    if (!lensHost) return undefined;

    const lens = new AuroraLens(lensHost, {
      allowEdit,
      sessionStore: new IndexedDbViewerSessionStore(),
      onAddError: (error) => onAddError?.(error),
      onError: (error) => onError?.(error),
      onStateChange: (nextState) => {
        setState(nextState);
        onStateChange?.(nextState);
      },
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus);
        onStatusChange?.(nextStatus);
      },
    });

    viewerRef.current = lens;
    onApiReady?.(lens);

    return () => {
      lens.close();
      viewerRef.current = null;
      onApiReady?.(null);
    };
  }, [allowEdit, onAddError, onError, onStateChange, onStatusChange, onApiReady]);

  const showThumbnails = () => requireViewer(viewerRef).showThumbnails();
  const previousPage = () => requireViewer(viewerRef).previousPage();
  const nextPage = () => requireViewer(viewerRef).nextPage();
  const hasChanges = () => {
    const viewer = viewerRef.current;
    if (typeof viewer?.isDirty !== "function") {
      return false;
    }
    return viewer.isDirty();
  };

  return {
    hasChanges,
    lensHostRef,
    nextPage,
    previousPage,
    showThumbnails,
    state,
    status,
  };
}
