import type { ImagePackage, ImageWorkerCommand, ImageWorkerResult } from "../type/image.types";

type ParsedResponse = {
  payload: unknown;
  response: Response;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function packageError(payload: Record<string, unknown>): ImageWorkerResult<never> {
  if (typeof payload.data !== "string") {
    return { ok: false, code: "validation_error", error: "Missing required key: data" };
  }
  return { ok: false, code: "image_package_error", details: payload, error: payload.data };
}

function readDataEnvelope(payload: unknown): ImageWorkerResult<ImagePackage> {
  if (!isObject(payload)) {
    return { ok: false, code: "validation_error", error: "Response is not a valid object." };
  }
  if (typeof payload.status !== "string") {
    return { ok: false, code: "validation_error", error: "Missing required key: status" };
  }
  if (payload.status === "error") return packageError(payload);
  if (payload.status !== "completed") {
    return { ok: false, code: "validation_error", details: payload, error: "Image package data status is invalid." };
  }
  if (!isObject(payload.data) || typeof payload.data.tiff !== "string" || typeof payload.data.data !== "string") {
    return { ok: false, code: "validation_error", details: payload, error: "Image package data is missing TIFF or JSON URLs." };
  }
  const data: ImagePackage["data"] = {
    data: payload.data.data,
    tiff: payload.data.tiff,
  };
  if (!/^https?:\/\//i.test(data.tiff) || !/^https?:\/\//i.test(data.data)) {
    return { ok: false, code: "validation_error", details: payload, error: "Image package data is missing TIFF or JSON URLs." };
  }
  return { ok: true, data: { data, status: "completed" } };
}

async function parseResponse(response: Response): Promise<ImageWorkerResult<ParsedResponse>> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  let responseText: string;
  try {
    responseText = await response.text();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), status: response.status };
  }
  if (responseText && contentType.includes("application/json")) {
    try {
      return { ok: true, data: { payload: JSON.parse(responseText), response } };
    } catch {
      return { ok: false, code: "invalid_json", error: "Response JSON could not be parsed.", status: response.status };
    }
  }
  if (response.ok) {
    return { ok: false, code: "non_json_response", error: "Response is not JSON.", status: response.status };
  }
  return { ok: true, data: { payload: responseText, response } };
}

function readHttpError(parsed: ParsedResponse): ImageWorkerResult<never> {
  const { payload, response } = parsed;
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

async function fetchApi(
  url: string,
  token: string,
  init: RequestInit,
): Promise<ImageWorkerResult<ImagePackage>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const parsed = await parseResponse(response);
  if (!parsed.ok) return parsed;
  if (!response.ok) return readHttpError(parsed.data);
  return readDataEnvelope(parsed.data.payload);
}

export class ImageWorker {
  async run(command: ImageWorkerCommand): Promise<ImageWorkerResult<ImagePackage>> {
    if (!command?.token) return { ok: false, code: "missing_auth_token", error: "Missing auth token" };
    if (!command.apiBaseUrl) return { ok: false, code: "missing_api_base_url", error: "Missing service base URL" };
    if (typeof command.session !== "string" || !command.session.trim()) return { ok: false, code: "invalid_session", error: "Session is missing or invalid." };
    return fetchApi(`${command.apiBaseUrl.replace(/\/+$/, "")}/v1/image/${encodeURIComponent(command.session)}/generate`, command.token, {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }
}

self.onmessage = async (event: MessageEvent<ImageWorkerCommand>) => {
  const worker = new ImageWorker();
  const result = await worker.run(event.data);
  self.postMessage(result);
};
