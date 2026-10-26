export type IqReport = Record<string, unknown>;

export type IqWorkerCommand = {
  apiBaseUrl: string;
  session: string;
  token: string;
};

export type IqWorkerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; status?: number; details?: unknown };

export type IqWorkerConfig = { apiBaseUrl: string };

export type IqWorkerClient = {
  generateReport(token: string, session: string): Promise<IqReport>;
};
