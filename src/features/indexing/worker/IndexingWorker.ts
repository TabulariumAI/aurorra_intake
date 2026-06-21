import type { IndexingWorkerCommand, IndexingWorkerResult } from "../type/indexing.types";

type JsonValue = Record<string, unknown>;

function isObject(value: unknown): value is JsonValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class IndexingWorker {
  async run<T>(command: IndexingWorkerCommand): Promise<IndexingWorkerResult<T>> {
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

    const method = command.type === "start" ? "POST" : "GET";
    const { url, body } = this.buildRequest(command);

    const headers = {
      Authorization: `Bearer ${command.token}`,
      ...(body !== null ? { "Content-Type": "application/json" } : {}),
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
        data: payload as T,
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

  buildRequest(command: IndexingWorkerCommand) {
    const API_BASE_URL = command.apiBaseUrl.replace(/\/+$/, "");
    const indexApiBaseUrl = `${API_BASE_URL}/v1/index`;
    switch (command.type) {
      case "start":
        return {
          url: `${indexApiBaseUrl}/${encodeURIComponent(command.session)}/new`,
          body: JSON.stringify({
            doc_name: command.document,
            choices: command.choices,
          }),
        };
      case "status":
        return {
          url: `${indexApiBaseUrl}/${encodeURIComponent(command.session)}/status`,
          body: null,
        };
    }
  }
}

self.onmessage = async (event: MessageEvent<IndexingWorkerCommand>) => {
  const worker = new IndexingWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
