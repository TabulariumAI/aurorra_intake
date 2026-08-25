import type { StoreAdapter } from "../../../store/type/store.types";
import type { ProgressActions } from "../../progressview/type/progress.types";

export type SessionDocument = File | { name: string; type: string } | null;

export type SessionExtension = "pdf" | "tiff" | "tif";

export type SessionStartData = {
  session: string;
  sas_token: string;
  base_url: string;
};

export type SessionWorkerCommand =
  | { type: "newSession"; token: string; apiBaseUrl: string }
  | { type: "summary"; token: string; apiBaseUrl: string; session: string; document: string }
  | { type: "setTags"; token: string; apiBaseUrl: string; session: string; tags: string[] | null }
  | { type: "sessionData"; token: string; apiBaseUrl: string; session: string };

export type SessionWorkerSuccess<T> = {
  ok: true;
  data: T;
};

export type SessionWorkerFailure = {
  ok: false;
  error: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export type SessionWorkerResult<T> = SessionWorkerSuccess<T> | SessionWorkerFailure;

export type SessionWorkerClient = {
  newSession(token: string): Promise<SessionStartData>;
  summary(token: string, session: string, document: string): Promise<unknown>;
  setTags(token: string, session: string, tags: string[] | null): Promise<unknown>;
  sessionData(token: string, session: string): Promise<SessionStartData>;
};

export type SessionWorkerConfig = {
  apiBaseUrl: string;
};

export type SessionAlertMessage = {
  code: string;
  args?: Record<string, string>;
};

export type SessionAlertMessages = Record<string, SessionAlertMessage> & {
  DOC_START_NO_DOCUMENT: SessionAlertMessage;
  INV_FILE_FMT: SessionAlertMessage;
  TIFF_NOT_VALID: SessionAlertMessage;
};

export type SessionAlert = {
  format(message: SessionAlertMessage, args?: Record<string, string>): string;
};

export type SessionEvents = {
  reRoute: { detail: { stage: string; file: string } };
};

export type SessionEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
};

export type SessionRuntime = {
  alert: SessionAlert;
  messages: SessionAlertMessages;
  eventBus: SessionEventBus;
  events: SessionEvents;
  progress: ProgressActions;
  store: StoreAdapter;
  sessionWorkerClient: SessionWorkerClient;
};

export type SessionLoadRuntime = Pick<SessionRuntime, "sessionWorkerClient" | "store">;

export type SessionLoaded = {
  baseUrl: string;
  document: string;
  sasToken: string;
  session: string;
};

export type SessionServiceActions = {
  process(document: SessionDocument, jobId: string): Promise<void>;
  setSession(session: string): Promise<SessionLoaded>;
};

export type ErrorLike = {
  error?: unknown;
  details?: unknown;
  message?: unknown;
};
