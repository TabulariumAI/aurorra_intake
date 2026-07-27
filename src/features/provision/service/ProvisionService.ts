import type {
  ProvisionDocument,
  ProvisionRuntime,
  ProvisionReviewHandle,
  ProvisionReviewOptions,
  ProvisionResult,
  ProvisionServiceActions,
  ProvisionState,
} from "../type/provision.types";

type ProvisionStateApi = {
  setState(state: ProvisionState): void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { error?: unknown; details?: unknown; message?: unknown } | null | undefined;
  const message = typeof candidate?.error === "string"
    ? candidate.error
    : typeof candidate?.details === "string"
      ? candidate.details
      : typeof candidate?.message === "string"
        ? candidate.message
        : undefined;
  return typeof message === "string" ? message : fallback;
}

function getAuthToken(runtime: ProvisionRuntime): string {
  const userToken = runtime.store.get("userToken");
  return typeof userToken === "object" && userToken !== null
    ? String((userToken as { token?: unknown }).token ?? "")
    : "";
}

function normalizeProvisionResponse(raw: unknown): ProvisionResult {
  const data = isRecord(raw) ? raw : {};
  const rawPageNum = data.pageNum ?? data.page_num;
  const pageNum = typeof rawPageNum === "number" ? rawPageNum : Number(rawPageNum);
  if (!Number.isFinite(pageNum)) {
    throw new Error("Invalid provision response");
  }

  if (!("description" in data) || !("accepted" in data)) {
    throw new Error("Invalid provision response");
  }

  return {
    pageNum,
    description: data.description,
    accepted: data.accepted,
  };
}

export class ProvisionService {
  #runtime: ProvisionRuntime;
  #stateApi: ProvisionStateApi;
  #provisionWorkerClient: ProvisionRuntime["provisionWorkerClient"];
  #review: ProvisionReviewHandle | null = null;

  constructor(runtime: ProvisionRuntime, stateApi: ProvisionStateApi) {
    this.#runtime = runtime;
    this.#stateApi = stateApi;
    this.#provisionWorkerClient = runtime.provisionWorkerClient;
  }

  #dismissReview() {
    this.#review?.dispose();
    this.#review = null;
  }

  async #renderReview(description: unknown, accepted: unknown, document: ProvisionDocument | string): Promise<void> {
    const runtime = this.#runtime;
    const actions = runtime.intake.actions;
    actions.showProvision("", "");
    this.#dismissReview();

    const reviewOptions: ProvisionReviewOptions = {
      description: String(description),
      accepted: Boolean(accepted),
      document,
      onContinue: async () => {
        this.#dismissReview();
        actions.showSelect("", "");
        runtime.eventBus.emit(runtime.events.reRoute, {
          [runtime.events.reRoute.detail.stage]: "indexing",
        });
      },
      onCancel: () => {
        this.#dismissReview();
        actions.showSelect("", "");
        runtime.onCanceled?.();
        runtime.eventBus.emit(runtime.events.newSession, undefined);
      },
    };

    this.#review = this.#runtime.createReview(runtime.intake.provisionHost, reviewOptions);
  }

  async process(document: ProvisionDocument | string) {
    const runtime = this.#runtime;
    const stateApi = this.#stateApi;

    if (runtime.store.get("provisionStepStatus") === true) {
      return;
    }

    runtime.store.set("provisionStepStatus", true);
    stateApi.setState({ isProcessing: true, lastError: null });
    let lastError: string | null = null;

    try {

      /*Step1: validation */

      const token = getAuthToken(runtime);
      if (!token) {
        throw new Error("Missing auth token");
      }

      const session = runtime.store.get("session");
      if (!session) {
        throw new Error(runtime.alert.format(
          runtime.messages.SESSION_MISSING));
      }

      const documentName = runtime.store.get("document");
      if (!documentName) {
        throw new Error(runtime.alert.format(
          runtime.messages.DOCUMENT_MISSING));
      }

      const reviewedDocument = document ?? documentName;
      const jobId = crypto.randomUUID();
      runtime.onJobEvent?.({ jobId, message: "Screening document", phase: "started", session: String(session) });
      let response: unknown;
      try {
        response = await this.#provisionWorkerClient.provision(
          token,
          String(session),
          String(documentName),
        );
        runtime.onJobEvent?.({ jobId, message: "Document screened", phase: "completed", session: String(session) });
      } catch (error) {
        const message = getErrorMessage(error, "Document screening failed.");
        runtime.onJobEvent?.({ error: message, jobId, message: "Document screening failed", phase: "failed", session: String(session) });
        throw error;
      }
      const result = normalizeProvisionResponse(response);

      runtime.store.set("numOfPages", result.pageNum);
      await this.#renderReview(result.description, result.accepted, reviewedDocument as ProvisionDocument | string);

    } catch (error) {
      const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "processing request",
      });
      const message = getErrorMessage(error, fallback);
      runtime.eventBus.emit(runtime.events.showAlert, {
        message,
      });
      lastError = message;
      throw new Error(String(message), { cause: error });
    } finally {
      runtime.store.set("provisionStepStatus", false);
      stateApi.setState({ isProcessing: false, lastError });
    }
  }

  clear() {
    this.#dismissReview();
    this.#runtime.intake.actions.showSelect("", "");
    this.#runtime.store.set("provisionStepStatus", false);
    this.#stateApi.setState({ isProcessing: false, lastError: null });
  }
}

export function createProvisionService(runtime: ProvisionRuntime, stateApi: ProvisionStateApi): ProvisionServiceActions {
  return new ProvisionService(runtime, stateApi);
}
