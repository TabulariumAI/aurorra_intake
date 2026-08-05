import type { ChoicesBackendData, ChoicesWorkerCommand, ChoicesWorkerResult } from "../type/choices.types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export class ChoicesWorker {
  async run(command: ChoicesWorkerCommand): Promise<ChoicesWorkerResult<ChoicesBackendData>> {
    if (!command?.token) {
      return {
        ok: false,
        error: "Missing auth token",
        code: "missing_auth_token",
      };
    }

    if (!command.session || typeof command.session !== "string") {
      return {
        ok: false,
        error: "Session is missing or invalid.",
        code: "bad_request",
      };
    }

    const url = this.buildUrl(command);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${command.token}`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: message,
      };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    const responseText = await response.text();
    let payload: unknown = null;

    if (responseText && contentType.includes("application/json")) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = responseText;
      }
    } else if (responseText) {
      payload = responseText;
    }

    if (response.ok) {
      return {
        ok: true,
        data: payload as ChoicesBackendData,
      };
    }

    let error = `HTTP ${response.status}`;
    let code: string | undefined;
    let details: unknown;

    if (isObject(payload)) {
      if (typeof payload.error === "string") {
        error = payload.error;
      }
      if (typeof payload.code === "string") {
        code = payload.code;
      }
      details = payload;
    }
    if (typeof payload === "string" && payload.trim()) {
      error = payload.trim();
    }

    return {
      ok: false,
      status: response.status,
      error,
      code,
      details,
    };
  }

  buildUrl(command: ChoicesWorkerCommand): string {
    const API_BASE_URL = trimTrailingSlash(command.config.apiBaseUrl);
    return `${API_BASE_URL}/v1/index/${encodeURIComponent(command.session)}/choices`;
  }
}

self.onmessage = async (event: MessageEvent<ChoicesWorkerCommand>) => {
  const worker = new ChoicesWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
