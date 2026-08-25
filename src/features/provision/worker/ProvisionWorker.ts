import type { ProvisionWorkerCommand, ProvisionWorkerResult } from "../type/provision.types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class ProvisionWorker {
  async run<T>(command: ProvisionWorkerCommand): Promise<ProvisionWorkerResult<T>> {
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

    const { url, body } = this.buildRequest(command);
    const headers = {
      Authorization: `Bearer ${command.token}`,
      "Content-Type": "application/json",
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
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

  buildRequest(command: ProvisionWorkerCommand): { url: string; body: string } {
    const apiBaseUrl = command.apiBaseUrl.replace(/\/+$/, "");
    return {
      url: `${apiBaseUrl}/v1/session/${encodeURIComponent(command.session)}/provision`,
      body: JSON.stringify({ doc_name: command.document }),
    };
  }
}

self.onmessage = async (event: MessageEvent<ProvisionWorkerCommand>) => {
  const worker = new ProvisionWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
