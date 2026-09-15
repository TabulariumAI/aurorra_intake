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
      const jobId = crypto.randomUUID();
      runtime.progress.reset();
      runtime.progress.receive({ jobId, message: "Creating a session", phase: "started" });
      try {
        runtime.store.set("numOfPages", pageCount);
        const document = await getDocument();
        if (!document) {
          throw new Error("Failed to get the selected file.");
        }
        await runtime.eventBus.emitAsync(runtime.events.reRoute, {
          [runtime.events.reRoute.detail.stage]: "session",
          [runtime.events.reRoute.detail.file]: document,
          [runtime.events.reRoute.detail.jobId]: jobId,
        });
      } catch (error) {
        console.error("[Intake:selection]", error);
        const message = getSelectErrorMessage(error, "Session creation failed.");
        runtime.progress.receive({ error: message, jobId, message: "Creating a session", phase: "failed" });
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
