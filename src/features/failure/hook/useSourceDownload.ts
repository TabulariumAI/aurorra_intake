import { useEffect, useRef, useState } from "react";
import type { FailedSessionProps } from "../type/failure.types";

export function useSourceDownload({ choices, sasToken, onDownload, formatError }: Pick<FailedSessionProps, "choices" | "sasToken" | "onDownload" | "formatError">) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const download = async () => {
    if (!choices?.source || sasToken === null || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, name } = await onDownload(choices.source, sasToken, request.signal);
      if (request.signal.aborted) return;
      const href = URL.createObjectURL(blob);
      try {
        link.current!.href = href;
        link.current!.download = name;
        link.current!.click();
      } finally {
        URL.revokeObjectURL(href);
      }
    } catch (failure) {
      if (!request.signal.aborted) setDownloadError(formatError(failure));
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setDownloading(false);
    }
  };

  return { downloading, downloadError, download, link };
}
