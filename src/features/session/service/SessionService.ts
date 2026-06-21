import type {
  ErrorLike,
  SessionChoicesData,
  SessionDocument,
  SessionExtension,
  SessionRuntime,
  SessionWorkerClient,
  SessionServiceActions,
  SessionState,
} from "../type/session.types";

type SessionStateApi = {
  setState(state: SessionState): void;
};

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

function normalizeChoices(choices: SessionChoicesData): unknown[] | null {
  if (choices == null) {
    return null;
  }
  if (Array.isArray(choices)) {
    return choices;
  }
  return Array.isArray(choices.items) ? choices.items : [];
}

function storeSession(
  runtime: SessionRuntime,
  session: string,
  sasToken: string,
  baseUrl: string,
  document: string,
  choices: unknown[] | null = null,
) {
  runtime.store.set("session", session);
  runtime.store.set("sasToken", sasToken);
  runtime.store.set("baseUrl", baseUrl);
  runtime.store.set("document", document);
  if (choices !== null) {
    runtime.store.set("indexChoices", choices);
  }
}

function getAuthToken(runtime: SessionRuntime): string {
  const userToken = runtime.store.get("userToken");
  return typeof userToken === "object" && userToken !== null
    ? String((userToken as { token?: unknown }).token ?? "")
    : "";
}

export class SessionService implements SessionServiceActions {
  #runtime: SessionRuntime;
  #stateApi: SessionStateApi;
  #sessionWorkerClient: SessionWorkerClient;

  constructor(runtime: SessionRuntime, stateApi: SessionStateApi, sessionWorkerClient: SessionWorkerClient) {
    this.#runtime = runtime;
    this.#stateApi = stateApi;
    this.#sessionWorkerClient = sessionWorkerClient;
  }

  async process(document: SessionDocument) {
    const runtime = this.#runtime;
    const stateApi = this.#stateApi;
    const sessionWorkerClient = this.#sessionWorkerClient;

    if (runtime.store.get("isSessionInProcess") === true) {
      return;
    }

    runtime.store.set("isSessionInProcess", true);
    stateApi.setState({ isProcessing: true, lastError: null });

    try {
      const ext = validateSessionDocument(runtime, document);
      const token = getAuthToken(runtime);
      if (!token) {
        throw new Error("Missing auth token");
      }

      runtime.intakeShell.progress.showOverlay();
      runtime.intakeShell.progress.startProcessing();
      runtime.intakeShell.progress.notify("Creating a new session");

      const data = await sessionWorkerClient.newSession(token);
      storeSession(runtime, data.session, data.sas_token, data.base_url, `${data.session}.${ext}`);
      runtime.eventBus.emit(runtime.events.reRoute, {
        [runtime.events.reRoute.detail.stage]: "upload",
        [runtime.events.reRoute.detail.file]: document,
      });
    } catch (error) {
      const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "processing request",
      });
      const message = getErrorMessage(error, fallback);
      stateApi.setState({ isProcessing: true, lastError: message });
      runtime.intakeShell.progress.endProcessing();
      runtime.intakeShell.progress.hideOverlay();
      runtime.eventBus.emit(runtime.events.showAlert, { message });
      console.error("Step1:", message);
    } finally {
      runtime.store.set("isSessionInProcess", false);
      stateApi.setState({ isProcessing: false, lastError: null });
    }
  }

  async setSession(session: string) {
    const runtime = this.#runtime;
    const sessionWorkerClient = this.#sessionWorkerClient;
    const token = getAuthToken(runtime);
    if (!token) {
      throw new Error("Missing auth token");
    }

    const choices = normalizeChoices(JSON.parse(JSON.stringify(await runtime.loadChoices(session))) as SessionChoicesData);
    const data = await sessionWorkerClient.sessionData(token, session);
    storeSession(runtime, data.session, data.sas_token, data.base_url, `${data.session}.pdf`, choices);
  }

  clear() {
    const runtime = this.#runtime;
    runtime.store.reset("baseUrl");
    runtime.store.reset("sasToken");
    runtime.store.reset("session");
    runtime.store.reset("numOfPages");
    runtime.intakeShell.progress.endProcessing();
    runtime.intakeShell.progress.hideOverlay();
  }
}

export function createSessionService(
  runtime: SessionRuntime,
  stateApi: SessionStateApi,
): SessionServiceActions {
  return new SessionService(runtime, stateApi, runtime.sessionWorkerClient);
}
