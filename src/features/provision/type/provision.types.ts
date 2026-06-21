import type { StoreAdapter } from "../../../store/type/store.types";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";

export type ProvisionDocument = File | {
  name: string;
  size: number;
};

export type ProvisionResult = {
  pageNum: number;
  description: unknown;
  accepted: unknown;
};

export type ProvisionState = {
  isProcessing: boolean;
  lastError: string | null;
};

export type ProvisionReviewOptions = {
  description: string;
  accepted: boolean;
  document: ProvisionDocument | string;
  onContinue: (document: ProvisionDocument | string) => Promise<void>;
  onCancel: () => void;
};

export type ProvisionReviewHandle = {
  dispose(): void;
};

export type ProvisionWorkerCommand =
  | { type: "provision"; token: string; apiBaseUrl: string; session: string; document: string }
  | { type: "provisionData"; token: string; apiBaseUrl: string; session: string };

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
  provisionData(token: string, session: string): Promise<unknown>;
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
    ERR_ACT: {
      args: {
        action: string;
      };
    };
  };
  eventBus: {
    emit(eventConfig: unknown, payload?: unknown): void;
  };
  events: {
    showAlert: unknown;
    newSession: unknown;
    reRoute: {
      detail: {
        stage: string;
      };
    };
  };
  store: StoreAdapter;
  intake: {
    actions: IntakeShellActions;
    provisionHost: HTMLElement;
  };
  intakeShell: IntakeShellActions;
  onCanceled?: () => void;
  provisionWorkerClient: ProvisionWorkerClient;
  createReview(container: HTMLElement, options: ProvisionReviewOptions): ProvisionReviewHandle;
};

export type ProvisionServiceActions = {
  process(document: ProvisionDocument | string): Promise<void>;
  clear(): void;
};
