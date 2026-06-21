import type { IndexingServiceActions } from "../../indexing/type/indexing.types";
import type { ProvisionDocument, ProvisionServiceActions } from "../../provision/type/provision.types";
import type { SessionDocument, SessionServiceActions } from "../../session/type/session.types";
import type { UploadDocument, UploadServiceActions } from "../../upload/type/upload.types";
import type { StoreAdapter } from "../../../store/type/store.types";

export type IntakeRouteStage = "session" | "upload" | "provision" | "indexing" | "metadata";

export type IntakeRouteEvent = {
  name: string;
  detail: {
    stage: string;
    file: string;
  };
};

export type IntakeRoutePayload = {
  stage?: IntakeRouteStage;
  file?: unknown;
};

export type IntakeCompletePayload = {
  baseUrl: unknown;
  document: unknown;
  indexChoices: unknown;
  numOfPages: unknown;
  sasToken: unknown;
  session: unknown;
  workflow: unknown;
};

type IntakeOrchestratorServices = {
  session: SessionServiceActions | null;
  upload: UploadServiceActions | null;
  provision: ProvisionServiceActions | null;
  indexing: IndexingServiceActions | null;
};

type IntakeOrchestratorRuntime = {
  getServices(): IntakeOrchestratorServices;
  onComplete?: (payload: IntakeCompletePayload) => void;
  store: StoreAdapter;
};

const ROUTE_STAGES = new Set<IntakeRouteStage>(["session", "upload", "provision", "indexing", "metadata"]);

function getCompletePayload(store: StoreAdapter): IntakeCompletePayload {
  return {
    baseUrl: store.get("baseUrl"),
    document: store.get("document"),
    indexChoices: store.get("indexChoices"),
    numOfPages: store.get("numOfPages"),
    sasToken: store.get("sasToken"),
    session: store.get("session"),
    workflow: store.get("workflow"),
  };
}

function getRouteFile(payload?: IntakeRoutePayload): File | null {
  const file = payload?.file;
  return file instanceof File ? file : null;
}

function getRouteStage(payload?: IntakeRoutePayload): IntakeRouteStage {
  const stage = payload?.stage ?? "session";
  if (!ROUTE_STAGES.has(stage)) {
    throw new Error(`Unknown intake route stage: ${String(stage)}`);
  }
  return stage;
}

export class IntakeOrchestrator {
  #runtime: IntakeOrchestratorRuntime;

  constructor(runtime: IntakeOrchestratorRuntime) {
    this.#runtime = runtime;
  }

  reset() {
    return undefined;
  }

  async route(payload?: IntakeRoutePayload) {
    const stage = getRouteStage(payload);
    const file = getRouteFile(payload);
    const services = this.#runtime.getServices();

    if (stage === "session") {
      if (!file) throw new Error("Document is missing.");
      await services.session?.process(file as SessionDocument);
      return;
    }

    if (stage === "upload") {
      if (!file) throw new Error("Document is missing.");
      await services.upload?.process(file as UploadDocument);
      return;
    }

    if (stage === "provision") {
      if (!file) throw new Error("Document is missing.");
      await services.provision?.process(file as ProvisionDocument);
      return;
    }

    if (stage === "indexing") {
      await services.indexing?.process();
      return;
    }

    this.#runtime.onComplete?.(getCompletePayload(this.#runtime.store));
  }
}

export function createIntakeOrchestrator(runtime: IntakeOrchestratorRuntime) {
  return new IntakeOrchestrator(runtime);
}
