import type { SessionWorkerCommand, SessionWorkerResult } from "../type/session.types";

const jsonHeaders = { "Content-Type": "application/json" };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class SessionWorker {
  async run<T>(command: SessionWorkerCommand): Promise<SessionWorkerResult<T>> {
    if (!command?.token) {
      return {
        ok: false,
        error: "Missing auth token",
        code: "missing_auth_token",
      };
    }
    if (!command.apiBaseUrl) {
      return {
        ok: false,
        error: "Missing API base URL",
        code: "missing_api_base_url",
      };
    }

    const method = command.type === "newSession" || command.type === "summary" || command.type === "setTags" ? "POST" : "GET";
    const { url, body } = this.buildRequest(command);

    const headers: HeadersInit = {
      Authorization: `Bearer ${command.token}`,
      ...(body !== null ? jsonHeaders : {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
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
        data: (payload as T),
      };
    }

    let error = `HTTP ${response.status}`;
    let code: string | undefined;
    let details: unknown;

    if (isObject(payload)) {
      const parsedError = payload.error;
      if (typeof parsedError === "string") {
        error = parsedError;
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

  buildRequest(command: SessionWorkerCommand): { url: string; body: string | null } {
    const API_BASE_URL = command.apiBaseUrl.replace(/\/+$/, "");
    const sessionApiBaseUrl = `${API_BASE_URL}/v1/session`;
    switch (command.type) {
      case "newSession":
        return {
          url: `${sessionApiBaseUrl}/new`,
          body: null,
        };
      case "summary":
        return {
          url: `${sessionApiBaseUrl}/${encodeURIComponent(command.session)}/summary`,
          body: JSON.stringify({ doc_name: command.document }),
        };
      case "setTags":
        return {
          url: `${sessionApiBaseUrl}/${encodeURIComponent(command.session)}/tags`,
          body: JSON.stringify({ tags: command.tags }),
        };
      case "sessionData":
        return {
          url: `${sessionApiBaseUrl}/${encodeURIComponent(command.session)}/data`,
          body: null,
        };
    }
  }
}

self.onmessage = async (event: MessageEvent<SessionWorkerCommand>) => {
  const worker = new SessionWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
