import type { IndexingServiceActions } from "../../indexing/type/indexing.types";
import type { ProvisionServiceActions } from "../../provision/type/provision.types";
import type { SessionDocument, SessionServiceActions } from "../../session/type/session.types";
import type { UploadDocument, UploadServiceActions } from "../../upload/type/upload.types";
import type { StoreAdapter } from "../../../store/type/store.types";
import type { DataExchange } from "aurora-core";

export type IntakeRouteStage = "session" | "upload" | "provision" | "indexing" | "metadata";

export type IntakeRouteEvent = {
  name: string;
  detail: {
    stage: string;
    file: string;
    jobId: string;
  };
};

export type IntakeRoutePayload = {
  stage: IntakeRouteStage;
  file?: unknown;
  jobId?: unknown;
};

export type IntakeSessionData = {
  baseUrl: unknown;
  document: unknown;
  numOfPages: unknown;
  sasToken: unknown;
};

export type IntakeCompletePayload = DataExchange & {
  data: IntakeSessionData;
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
  const session = store.get("session");
  return {
    batch: null,
    data: {
      baseUrl: store.get("baseUrl"),
      document: store.get("document"),
      numOfPages: store.get("numOfPages"),
      sasToken: store.get("sasToken"),
    },
    group: null,
    session: typeof session === "string" ? session : null,
  };
}

function getRouteFile(payload: IntakeRoutePayload): File | null {
  const file = payload.file;
  return file instanceof File ? file : null;
}

function getRouteStage(payload: IntakeRoutePayload): IntakeRouteStage {
  const stage = payload.stage;
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

  async route(payload: IntakeRoutePayload) {
    const stage = getRouteStage(payload);
    const file = getRouteFile(payload);
    const services = this.#runtime.getServices();

    if (stage === "session") {
      if (!file) throw new Error("Document is missing.");
      if (typeof payload.jobId !== "string") throw new Error("Job id is missing.");
      if (!services.session) throw new Error("Session service is not ready.");
      await services.session.process(file as SessionDocument, payload.jobId);
      return;
    }

    if (stage === "upload") {
      if (!file) throw new Error("Document is missing.");
      if (!services.upload) throw new Error("Upload service is not ready.");
      await services.upload.process(file as UploadDocument);
      return;
    }

    if (stage === "provision") {
      if (!services.provision) throw new Error("Provision service is not ready.");
      await services.provision.process();
      return;
    }

    if (stage === "indexing") {
      if (!services.indexing) throw new Error("Indexing service is not ready.");
      await services.indexing.process();
      return;
    }

    this.#runtime.onComplete?.(getCompletePayload(this.#runtime.store));
  }
}

export function createIntakeOrchestrator(runtime: IntakeOrchestratorRuntime) {
  return new IntakeOrchestrator(runtime);
}
