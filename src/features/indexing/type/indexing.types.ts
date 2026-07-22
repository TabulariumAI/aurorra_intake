import type { StoreAdapter } from "../../../store/type/store.types";
import type { JobEventCallback } from "aurora-contracts";

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

export type IndexingState = {
  isProcessing: boolean;
  lastError: string | null;
};

export type IndexingStatusValue = "pending" | "processing" | "completed" | "error";

export type IndexingStatusResponse = {
  status: IndexingStatusValue;
  data: string;
};

export type IndexingServiceActions = {
  process(): Promise<void>;
  start(session: string, name: unknown, choices: unknown): Promise<void>;
  checkStatus(session: string, docName: unknown): Promise<boolean>;
};

export type IndexingRuntime = {
  alert: {
    format(message: unknown, args?: Record<string, string>): string;
  };
  messages: {
    ERR_ACT: { args: { action: string } };
    REPORT_WAIT: unknown;
    SESSION_REQ_INFO: unknown;
  };
  eventBus: {
    emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
  };
  events: {
    reRoute: { detail: { stage: string } };
    showAlert: unknown;
  };
  store: StoreAdapter;
  choices: {
    getActualPages(choices: unknown, pages: unknown): number;
    getIdentifyingIndexes(choices: unknown, structure: unknown): string[];
    getIdEnh(choices: unknown, structure: unknown): string[];
    getDefaultChoices(structure: unknown): unknown[];
    normalizeChoices(choices: unknown, structure: unknown): unknown[];
  };
  choiceStructure: unknown;
  baseIntervalMs: number;
  indexingWorkerClient: IndexingWorkerClient;
  onJobEvent?: JobEventCallback;
  notify(src: string): Promise<void>;
  getAuthToken(): string;
};
