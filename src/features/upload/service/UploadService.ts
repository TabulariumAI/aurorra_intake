import type {
  UploadContext,
  UploadDocument,
  UploadRuntime,
  UploadServiceActions,
  UploadWorkerClient,
} from "../type/upload.types";
import { workflowValue } from "../../choices/service/choicesData";
import type { WorkflowSettings } from "../../choices/type/choices.types";

type ErrorLike = {
  error?: unknown;
  details?: unknown;
  message?: unknown;
};

function getErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorLike | null | undefined;
  const message = candidate?.error ?? candidate?.details ?? candidate?.message;
  return typeof message === "string" ? message : fallback;
}

function requireString(value: unknown, message: unknown, runtime: UploadRuntime): string {
  if (!value) {
    throw new Error(runtime.alert.format(message));
  }
  return String(value);
}

export function resolveUploadContext(runtime: UploadRuntime): UploadContext {
  const sasToken = requireString(
    runtime.store.get("sasToken"),
    runtime.messages.UPLOAD_TOKEN_MISSING,
    runtime,
  );
  const baseUrl = requireString(
    runtime.store.get("baseUrl"),
    runtime.messages.UPLOAD_BASEURL_MISSING,
    runtime,
  );
  const docName = requireString(
    runtime.store.get("document"),
    runtime.messages.UPLOAD_DOCNAME_MISSING,
    runtime,
  );
  const session = requireString(
    runtime.store.get("session"),
    runtime.messages.SESSION_MISSING,
    runtime,
  );

  return { sasToken, baseUrl, docName, session };
}

export class UploadService implements UploadServiceActions {
  #runtime: UploadRuntime;
  #uploadWorkerClient: UploadWorkerClient;

  constructor(runtime: UploadRuntime, uploadWorkerClient: UploadWorkerClient) {
    this.#runtime = runtime;
    this.#uploadWorkerClient = uploadWorkerClient;
  }

  async process(document: UploadDocument) {
    const runtime = this.#runtime;

    if (runtime.store.get("uploadingStepStatus") === true) {
      return;
    }

    runtime.store.set("uploadingStepStatus", true);
    const jobId = crypto.randomUUID();
    runtime.progress.receive({ jobId, message: "Uploading your document", phase: "started" });

    try {
      if (!document) {
        throw new Error(runtime.alert.format(runtime.messages.DOCUMENT_MISSING));
      }

      const context = resolveUploadContext(runtime);
      await this.#uploadWorkerClient.upload({
        sasToken: context.sasToken,
        baseUrl: context.baseUrl,
        file: document,
        path: context.docName,
      });
      runtime.progress.receive({ jobId, message: "Uploading your document", phase: "completed" });

      const shouldReview = workflowValue(runtime.store.get("workflow") as WorkflowSettings, "Review");
      if (shouldReview) {
        runtime.eventBus.emit(runtime.events.reRoute, {
          [runtime.events.reRoute.detail.stage]: "provision",
          [runtime.events.reRoute.detail.file]: document,
        });
      } else {
        runtime.eventBus.emit(runtime.events.reRoute, {
          [runtime.events.reRoute.detail.stage]: "indexing",
        });
      }
    } catch (error) {
      const message = getErrorMessage(error, "Document upload failed.");
      runtime.progress.receive({ error: message, jobId, message: "Uploading your document", phase: "failed" });
    } finally {
      runtime.store.set("uploadingStepStatus", false);
    }
  }

}

export function createUploadService(runtime: UploadRuntime): UploadServiceActions {
  return new UploadService(runtime, runtime.uploadWorkerClient);
}
