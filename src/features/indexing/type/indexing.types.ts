import type { IntakeConfig } from "../../intake/type/intake.types";
import type { StoreAdapter } from "../../../store/type/store.types";
import type { ProgressActions } from "../../progressview/type/progress.types";
import type { ImageWorkerClient } from "../../image/type/image.types";
import type { IqWorkerClient } from "../../iq/type/iq.types";

export type IndexingWorkerCommand =
  | {
      type: "start";
      token: string;
      apiBaseUrl: string;
      session: string;
      document: string;
      choices: unknown;
      jurisdiction: string | null;
    }
  | {
      type: "status";
      token: string;
      apiBaseUrl: string;
      session: string;
    };

export type IndexingWorkerSuccess<T> = {
  ok: true;
  data: T;
};

export type IndexingWorkerFailure = {
  ok: false;
  error: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export type IndexingWorkerResult<T> = IndexingWorkerSuccess<T> | IndexingWorkerFailure;

export type IndexingWorkerClient = {
  start(token: string, session: string, document: string, choices: unknown, jurisdiction: string | null): Promise<unknown>;
  status(token: string, session: string): Promise<unknown>;
};

export type IndexingWorkerConfig = {
  apiBaseUrl: string;
};

export type IndexingStatusValue = "pending" | "processing" | "completed" | "error";

export type IndexingStatusResponse =
  | { status: "completed"; data: string; etag: string }
  | { status: Exclude<IndexingStatusValue, "completed">; data: string };

export type IndexingServiceActions = {
  process(): Promise<void>;
  start(session: string, name: unknown, choices: unknown, jurisdiction: string | null): Promise<void>;
  checkStatus(session: string): Promise<IndexingStatusResponse>;
};

export type IndexingRuntime = {
  config: IntakeConfig;
  onIndexed(result: { session: string; document: string; etag: string }): void;
  alert: {
    format(message: unknown, args?: Record<string, string>): string;
  };
  messages: {
    ERR_ACT: { args: { action: string } };
    SESSION_REQ_INFO: unknown;
  };
  eventBus: {
    emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
  };
  events: {
    reRoute: { detail: { stage: string } };
  };
  store: StoreAdapter;
  baseIntervalMs: number;
  intervalPageMs: number;
  indexingWorkerClient: IndexingWorkerClient;
  iqWorkerClient: IqWorkerClient;
  imageWorkerClient: ImageWorkerClient;
  progress: ProgressActions;
  getAuthToken(): string;
};
