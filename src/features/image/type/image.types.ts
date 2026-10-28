export type ImagePackage = {
  status: "completed";
  data: { tiff: string; data: string };
};

export type ImageWorkerCommand = {
  apiBaseUrl: string;
  session: string;
  token: string;
};

export type ImageWorkerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; status?: number; details?: unknown };

export type ImageWorkerConfig = { apiBaseUrl: string };

export type ImageWorkerClient = {
  generatePackage(token: string, session: string): Promise<ImagePackage>;
};
