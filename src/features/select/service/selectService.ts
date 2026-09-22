import type { ErrorLike, SelectService } from "../type/select.types";
import type { SelectRuntime } from "../type/selectRuntime.types";

export function getSelectErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorLike | null | undefined;
  const message = [candidate?.error, candidate?.details, candidate?.message].find((value) => typeof value === "string" && value.length > 0);
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
    async start(pageCount, getDocument) {
      let jobId = crypto.randomUUID();
      let message = "Preparing your document…";
      runtime.progress.reset();
      runtime.progress.receive({ jobId, message, phase: "started" });
      try {
        runtime.store.set("numOfPages", pageCount);
        const document = await getDocument((progress) => {
          runtime.progress.receive({
            jobId,
            message: progress.phase === "finalizing" ? "Finalizing your document…" : message,
            phase: "started",
            progress: progress.phase === "pages" ? { completed: progress.completed, total: progress.total } : null,
          });
        });
        if (!document) {
          throw new Error("Failed to get the selected file.");
        }
        runtime.progress.receive({ jobId, message, phase: "completed", progress: null });
        jobId = crypto.randomUUID();
        message = "Creating a session";
        runtime.progress.receive({ jobId, message, phase: "started" });
        await runtime.eventBus.emitAsync(runtime.events.reRoute, {
          [runtime.events.reRoute.detail.stage]: "session",
          [runtime.events.reRoute.detail.file]: document,
          [runtime.events.reRoute.detail.jobId]: jobId,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        console.error("[Intake:selection]", error);
        runtime.progress.receive({ error: getSelectErrorMessage(error, "Session creation failed."), jobId, message, phase: "failed", progress: null });
        throw error;
      }
    },
    showSettings() {
      runtime.eventBus.emit(runtime.events.showChoices);
    },
    createTiffFile(blob) {
      return new File([blob], "document.tif", { type: "image/tiff" });
    },
  };
}
