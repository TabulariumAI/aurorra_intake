import type { StoreAdapter } from "../../../store/type/store.types";
import type { ProgressActions } from "../../progressview/type/progress.types";

export type IndexingWorkerCommand =
  | {
      type: "start";
      token: string;
      apiBaseUrl: string;
      session: string;
      document: string;
      choices: unknown;
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
  start(token: string, session: string, document: string, choices: unknown): Promise<unknown>;
  status(token: string, session: string): Promise<unknown>;
};

export type IndexingWorkerConfig = {
  apiBaseUrl: string;
};

export type IndexingStatusValue = "pending" | "processing" | "completed" | "error";

export type IndexingStatusResponse = {
  status: IndexingStatusValue;
  data: string;
};

export type IndexingServiceActions = {
  process(): Promise<void>;
  start(session: string, name: unknown, choices: unknown): Promise<void>;
  checkStatus(session: string): Promise<boolean>;
};

export type IndexingRuntime = {
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
  choices: {
    getActualPages(choices: unknown, pages: unknown): number;
    normalizeChoices(choices: unknown, structure: unknown): unknown[];
  };
  choiceStructure: unknown;
  baseIntervalMs: number;
  indexingWorkerClient: IndexingWorkerClient;
  progress: ProgressActions;
  getAuthToken(): string;
};
