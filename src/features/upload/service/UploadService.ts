import type {
  UploadContext,
  UploadDocument,
  UploadRuntime,
  UploadServiceActions,
  UploadState,
  UploadWorkerClient,
} from "../type/upload.types";

type UploadStateApi = {
  setState(state: UploadState): void;
};

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
  #stateApi: UploadStateApi;
  #uploadWorkerClient: UploadWorkerClient;

  constructor(runtime: UploadRuntime, stateApi: UploadStateApi, uploadWorkerClient: UploadWorkerClient) {
    this.#runtime = runtime;
    this.#stateApi = stateApi;
    this.#uploadWorkerClient = uploadWorkerClient;
  }

  async process(document: UploadDocument) {
    const runtime = this.#runtime;
    const stateApi = this.#stateApi;

    if (runtime.store.get("uploadingStepStatus") === true) {
      return;
    }

    runtime.store.set("uploadingStepStatus", true);
    stateApi.setState({ isProcessing: true, lastError: null });

    try {
      if (!document) {
        throw new Error(runtime.alert.format(runtime.messages.DOCUMENT_MISSING));
      }

      const context = resolveUploadContext(runtime);
      const jobId = crypto.randomUUID();
      runtime.onJobEvent?.({ job: "upload.document", jobId, message: "Uploading document", phase: "started", session: context.session });
      try {
        await this.#uploadWorkerClient.upload({
          sasToken: context.sasToken,
          baseUrl: context.baseUrl,
          file: document,
          path: context.docName,
        });
        runtime.onJobEvent?.({ job: "upload.document", jobId, message: "Document uploaded", phase: "completed", session: context.session });
      } catch (error) {
        const message = getErrorMessage(error, "Document upload failed.");
        runtime.onJobEvent?.({ error: message, job: "upload.document", jobId, message: "Document upload failed", phase: "failed", session: context.session });
        throw error;
      }

      runtime.eventBus.emit(runtime.events.reRoute, {
        [runtime.events.reRoute.detail.stage]: "provision",
        [runtime.events.reRoute.detail.file]: document,
      });
    } catch (error) {
      const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "processing request",
      });
      const message = getErrorMessage(error, fallback);
      stateApi.setState({ isProcessing: true, lastError: message });
      runtime.eventBus.emit(runtime.events.showAlert, {
        message,
        onClose: () => runtime.eventBus.emit(runtime.events.newSession, {}),
      });
    } finally {
      runtime.store.set("uploadingStepStatus", false);
      stateApi.setState({ isProcessing: false, lastError: null });
    }
  }

  clear() {
    const runtime = this.#runtime;
    runtime.store.set("uploadingStepStatus", false);
    this.#stateApi.setState({ isProcessing: false, lastError: null });
  }
}

export function createUploadService(runtime: UploadRuntime, stateApi: UploadStateApi): UploadServiceActions {
  return new UploadService(runtime, stateApi, runtime.uploadWorkerClient);
}
