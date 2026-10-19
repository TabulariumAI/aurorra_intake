import { useLayoutEffect, useRef, useState } from "react";
import { AuroraLens, IndexedDbViewerSessionStore } from "@tabulariumai/aurora-lens";
import type { ViewerState, ViewerStatus } from "@tabulariumai/aurora-lens";
import type { ViewerApi, SelectViewerProps } from "../type/selectViewer.types";


export function useSelectViewer({
  pageSize,
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
      pageSize,
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
  }, [pageSize, allowEdit, onAddError, onError, onStateChange, onStatusChange, onApiReady]);

  return {
    lensHostRef,
    nextPage: () => viewerRef.current?.nextPage().catch(() => undefined),
    previousPage: () => viewerRef.current?.previousPage().catch(() => undefined),
    showThumbnails: () => viewerRef.current?.showThumbnails().catch(() => undefined),
    state,
    status,
  };
}
