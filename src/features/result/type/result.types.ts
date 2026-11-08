export type ResultData = Record<string, unknown>;
export type ResultResource = "metadata" | "audit" | "iq";

export type ResultValue = {
  status: "idle" | "loading" | "success" | "error";
  data: ResultData | null;
  error: string | null;
};

export type IntakeResult = Record<ResultResource, ResultValue>;

export type ResultCommand = {
  apiBaseUrl: string;
  session: string;
  token: string;
  resource: ResultResource;
};

export type ResultResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; status?: number; details?: unknown };

export type ResultConfig = { apiBaseUrl: string };

export type ResultClient = {
  load(token: string, session: string, resource: ResultResource): Promise<ResultData>;
};

export type ResultActions = {
  begin(session: string): string;
  load(requestId: string, resource: ResultResource, client: ResultClient, token: string): Promise<void>;
  reset(): void;
};
