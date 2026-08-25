import type { StoreAdapter } from "../../../store/type/store.types";
import type { ProgressActions } from "../../progressview/type/progress.types";

export type UploadDocument = File | {
  name: string;
  size: number;
  type?: string;
};

export type UploadContext = {
  sasToken: string;
  baseUrl: string;
  docName: string;
  session: string;
};

export type UploadWorkerCommand = {
  type: "upload";
  sasToken: string;
  baseUrl: string;
  file: UploadDocument;
  path: string;
};

export type UploadWorkerSuccess<T> = {
  ok: true;
  data: T;
};

export type UploadWorkerFailure = {
  ok: false;
  error: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export type UploadWorkerResult<T> = UploadWorkerSuccess<T> | UploadWorkerFailure;

export type UploadWorkerClient = {
  upload(command: Omit<UploadWorkerCommand, "type">): Promise<unknown>;
};

export type UploadServiceActions = {
  process(document: UploadDocument): Promise<void>;
};

export type UploadRuntime = {
  alert: {
    format(message: unknown, args?: Record<string, unknown>): string;
  };
  messages: {
    UPLOAD_TOKEN_MISSING: unknown;
    UPLOAD_BASEURL_MISSING: unknown;
    UPLOAD_DOCNAME_MISSING: unknown;
    SESSION_MISSING: unknown;
    DOCUMENT_MISSING: unknown;
  };
  eventBus: {
    emit(eventConfig: unknown, payload?: unknown): void;
  };
  events: {
    reRoute: {
      detail: {
        stage: string;
        file: string;
      };
    };
  };
  progress: ProgressActions;
  store: StoreAdapter;
  uploadWorkerClient: UploadWorkerClient;
};
