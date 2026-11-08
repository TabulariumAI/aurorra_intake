import type { ResultData, ResultCommand, ResultResponse } from "../type/result.types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function parseResponse(response: Response): Promise<ResultResponse<unknown>> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  let responseText: string;
  try {
    responseText = await response.text();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), status: response.status };
  }
  let payload: unknown = null;

  if (responseText && contentType.includes("application/json")) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      return { ok: false, code: "invalid_json", error: "Response JSON could not be parsed.", status: response.status };
    }
  } else if (responseText) {
    payload = responseText;
  }

  if (response.ok && !contentType.includes("application/json")) {
    return { ok: false, code: "non_json_response", error: "Response is not JSON.", status: response.status };
  }

  return { ok: true, data: payload };
}

function httpError(response: Response, payload: unknown): ResultResponse<never> {
  let error = `HTTP ${response.status}`;
  let code: string | undefined;
  let details: unknown;
  if (isObject(payload)) {
    if (typeof payload.error === "string") error = payload.error;
    else if (typeof payload.message === "string") error = payload.message;
    if (typeof payload.code === "string") code = payload.code;
    details = payload;
  } else if (typeof payload === "string" && payload.trim()) {
    error = payload.trim();
  }
  return { ok: false, code, details, error, status: response.status };
}

async function fetchJson(url: string): Promise<ResultResponse<unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!response.ok) {
    const parsed = await parseResponse(response);
    return parsed.ok ? httpError(response, parsed.data) : parsed;
  }
  try {
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, code: "invalid_json", error: "Response JSON could not be parsed.", status: response.status };
  }
}

export class ResultWorker {
  async run(command: ResultCommand): Promise<ResultResponse<ResultData>> {
    if (!command?.token) {
      return { ok: false, code: "missing_auth_token", error: "Missing auth token" };
    }
    if (!command.apiBaseUrl) {
      return { ok: false, code: "missing_api_base_url", error: "Missing service base URL" };
    }
    if (typeof command.session !== "string" || !command.session.trim()) {
      return { ok: false, code: "invalid_session", error: "Session is missing or invalid." };
    }
    const session = encodeURIComponent(command.session);
    const path = command.resource === "audit" ? `metadata/${session}/audit` : `${command.resource}/${session}/data`;
    let response: Response;
    try {
      response = await fetch(`${command.apiBaseUrl.replace(/\/+$/, "")}/v1/${path}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${command.token}`,
        },
        method: "GET",
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }

    const parsed = await parseResponse(response);
    if (!parsed.ok) return parsed;
    if (!response.ok) return httpError(response, parsed.data);
    const payload = parsed.data;
    if (isObject(payload) && typeof payload.data === "string") {
      if (payload.status === "error") {
        return { ok: false, code: `${command.resource}_error`, details: payload, error: payload.data };
      }
      if (payload.status === "completed") {
        const report = await fetchJson(payload.data);
        if (!report.ok) return report;
        if (isObject(report.data)) return { ok: true, data: report.data };
      }
    }
    return { ok: false, code: "validation_error", error: `Response is not a valid ${command.resource === "iq" ? "IQ report" : command.resource + " result"}.` };
  }
}

self.onmessage = async (event: MessageEvent<ResultCommand>) => {
  const worker = new ResultWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
