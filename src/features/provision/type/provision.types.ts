import type { StoreAdapter } from "../../../store/type/store.types";
import type { ProgressActions } from "../../progressview/type/progress.types";

export type ProvisionResult = {
  pageNum: number;
  description: unknown;
  accepted: unknown;
};

export type ProvisionWorkerCommand = {
  type: "provision";
  token: string;
  apiBaseUrl: string;
  session: string;
  document: string;
};

export type ProvisionWorkerSuccess<T> = {
  ok: true;
  data: T;
};

export type ProvisionWorkerFailure = {
  ok: false;
  error: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export type ProvisionWorkerResult<T> = ProvisionWorkerSuccess<T> | ProvisionWorkerFailure;

export type ProvisionWorkerClient = {
  provision(token: string, session: string, document: string): Promise<unknown>;
};

export type ProvisionWorkerConfig = {
  apiBaseUrl: string;
};

export type ProvisionRuntime = {
  alert: {
    format(message: unknown, args?: Record<string, unknown>): string;
  };
  messages: {
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
      };
    };
  };
  store: StoreAdapter;
  progress: ProgressActions;
  restart(): void;
  provisionWorkerClient: ProvisionWorkerClient;
};

export type ProvisionServiceActions = {
  process(): Promise<void>;
};
