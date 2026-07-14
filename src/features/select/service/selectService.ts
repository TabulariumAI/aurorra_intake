import type { ErrorLike, SelectService } from "../type/select.types";
import type { SelectRuntime } from "../type/selectRuntime.types";

export function getSelectErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorLike | null | undefined;
  const message = candidate?.error ?? candidate?.details ?? candidate?.message;
  return typeof message === "string" ? message : fallback;
}

export function createSelectService(runtime: SelectRuntime): SelectService {
  return {
    clear() {
      runtime.store.set("documentSelected", false);
    },
    isDocumentSelected() {
      return runtime.store.get("documentSelected") === true;
    },
    setDocumentSelected(selected) {
      runtime.store.set("documentSelected", selected);
    },
    setPageCount(pageCount) {
      runtime.store.set("numOfPages", pageCount);
    },
    async emitRoute(document) {
      await runtime.eventBus.emitAsync(runtime.events.reRoute, {
        [runtime.events.reRoute.detail.stage]: "session",
        [runtime.events.reRoute.detail.file]: document,
      });
    },
    showSettings() {
      runtime.eventBus.emit(runtime.events.showChoices);
    },
    getProgressIntervalMs() {
      return runtime.intervalMs;
    },
    createTiffFile(blob) {
      return new File([blob], "document.tif", { type: "image/tiff" });
    },
    getErrorMessage(error, fallback) {
      const formattedFallback = fallback || runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "processing request",
      });
      return getSelectErrorMessage(error, formattedFallback);
    },
  };
}
