import type {
  ErrorLike,
  SessionDocument,
  SessionExtension,
  SessionLoadRuntime,
  SessionRuntime,
  SessionLoaded,
  SessionStartData,
  SessionWorkerClient,
  SessionServiceActions,
} from "../type/session.types";

function getErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorLike | null | undefined;
  const message = candidate?.error ?? candidate?.details ?? candidate?.message;
  return typeof message === "string" ? message : fallback;
}

export function validateSessionDocument(runtime: SessionRuntime, document: SessionDocument): SessionExtension {
  if (!document) {
    throw new Error(runtime.alert.format(runtime.messages.DOC_START_NO_DOCUMENT));
  }

  const ext = document.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf" && ext !== "tiff" && ext !== "tif") {
    throw new Error(runtime.alert.format(runtime.messages.INV_FILE_FMT));
  }

  if ((ext === "tiff" || ext === "tif") && document.type !== "image/tiff") {
    throw new Error(runtime.alert.format(runtime.messages.TIFF_NOT_VALID));
  }

  return ext;
}

function storeSession(
  runtime: Pick<SessionRuntime, "store">,
  session: string,
  sasToken: string,
  baseUrl: string,
  document: string,
) {
  runtime.store.set("session", session);
  runtime.store.set("sasToken", sasToken);
  runtime.store.set("baseUrl", baseUrl);
  runtime.store.set("document", document);
}

function getAuthToken(runtime: Pick<SessionRuntime, "store">): string {
  const userToken = runtime.store.get("userToken");
  return typeof userToken === "object" && userToken !== null
    ? String((userToken as { token?: unknown }).token ?? "")
    : "";
}

export class SessionService implements SessionServiceActions {
  #runtime: SessionRuntime;
  #sessionWorkerClient: SessionWorkerClient;

  constructor(runtime: SessionRuntime, sessionWorkerClient: SessionWorkerClient) {
    this.#runtime = runtime;
    this.#sessionWorkerClient = sessionWorkerClient;
  }

  async process(document: SessionDocument, jobId: string) {
    const runtime = this.#runtime;
    const sessionWorkerClient = this.#sessionWorkerClient;

    if (runtime.store.get("isSessionInProcess") === true) {
      return;
    }

    runtime.store.set("isSessionInProcess", true);

    try {
      const ext = validateSessionDocument(runtime, document);
      const token = getAuthToken(runtime);
      if (!token) {
        throw new Error("Missing auth token");
      }

      const data: SessionStartData = await sessionWorkerClient.newSession(token);
      storeSession(runtime, data.session, data.sas_token, data.base_url, `${data.session}.${ext}`);
      runtime.onJobEvent?.({ jobId, message: "Session created", phase: "completed", session: data.session });
      runtime.eventBus.emit(runtime.events.reRoute, {
        [runtime.events.reRoute.detail.stage]: "upload",
        [runtime.events.reRoute.detail.file]: document,
      });
    } catch (error) {
      const jobMessage = getErrorMessage(error, "Session creation failed.");
      runtime.onJobEvent?.({ error: jobMessage, jobId, message: "Session creation failed", phase: "failed", session: null });
      const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "processing request",
      });
      const message = getErrorMessage(error, fallback);
      runtime.eventBus.emit(runtime.events.showAlert, { message });
      console.error("Step1:", message);
    } finally {
      runtime.store.set("isSessionInProcess", false);
    }
  }

  async setSession(session: string): Promise<SessionLoaded> {
    return loadSession(this.#runtime, session);
  }

  clear() {
    const runtime = this.#runtime;
    runtime.store.reset("baseUrl");
    runtime.store.reset("sasToken");
    runtime.store.reset("session");
    runtime.store.reset("numOfPages");
  }
}

export async function loadSession(runtime: SessionLoadRuntime, session: string): Promise<SessionLoaded> {
  const sessionWorkerClient = runtime.sessionWorkerClient;
  const token = getAuthToken(runtime);
  if (!token) {
    throw new Error("Missing auth token");
  }

  const jobId = crypto.randomUUID();
  runtime.onJobEvent?.({ jobId, message: "Loading session data", phase: "started", session });
  let data: SessionStartData;
  try {
    data = await sessionWorkerClient.sessionData(token, session);
    runtime.onJobEvent?.({ jobId, message: "Session data loaded", phase: "completed", session });
  } catch (error) {
    const message = getErrorMessage(error, "Session data load failed.");
    runtime.onJobEvent?.({ error: message, jobId, message: "Session data load failed", phase: "failed", session });
    throw error;
  }
  const loaded = {
    baseUrl: data.base_url,
    document: `${data.session}.pdf`,
    sasToken: data.sas_token,
    session: data.session,
  } satisfies SessionLoaded;
  storeSession(runtime, loaded.session, loaded.sasToken, loaded.baseUrl, loaded.document);
  return loaded;
}

export function createSessionService(runtime: SessionRuntime): SessionServiceActions {
  return new SessionService(runtime, runtime.sessionWorkerClient);
}
