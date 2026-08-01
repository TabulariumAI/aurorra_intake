import { describe, expect, it, vi } from "vitest";
import { createIntakeOrchestrator } from "../service/intakeOrchestrator";
import type { StoreAdapter } from "../../../store/type/store.types";

function createStore(seed: Record<string, unknown> = {}): StoreAdapter {
  const values = {
    baseUrl: "https://storage.test",
    document: "session-1.pdf",
    indexChoices: [{ service: "Recognition", level: 5 }],
    numOfPages: 3,
    sasToken: "sas-1",
    session: "session-1",
    workflow: true,
    ...seed,
  } as Record<string, unknown>;

  return {
    clearStorage: vi.fn(),
    get: vi.fn((key: string) => values[key]),
    getStoredInformation: vi.fn(),
    reset: vi.fn(),
    set: vi.fn(),
  } as unknown as StoreAdapter;
}

describe("IntakeOrchestrator", () => {
  it("routes session, upload, provision, and indexing stages to matching services", async () => {
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    const services = {
      session: { process: vi.fn(async () => undefined), setSession: vi.fn(), clear: vi.fn() },
      upload: { process: vi.fn(async () => undefined), clear: vi.fn() },
      provision: { process: vi.fn(async () => undefined), clear: vi.fn() },
      indexing: { process: vi.fn(async () => undefined), start: vi.fn(), checkStatus: vi.fn() },
    };
    const orchestrator = createIntakeOrchestrator({
      getServices: () => services,
      store: createStore(),
    });

    await orchestrator.route({ stage: "session", file, jobId: "job-1" });
    await orchestrator.route({ stage: "upload", file });
    await orchestrator.route({ stage: "provision", file });
    await orchestrator.route({ stage: "indexing" });

    expect(services.session.process).toHaveBeenCalledWith(file, "job-1");
    expect(services.upload.process).toHaveBeenCalledWith(file);
    expect(services.provision.process).toHaveBeenCalledWith(file);
    expect(services.indexing.process).toHaveBeenCalledTimes(1);
  });

  it("requires a document for document-bound route stages", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });

    await expect(orchestrator.route({ stage: "session" })).rejects.toThrow("Document is missing.");
    await expect(orchestrator.route({ stage: "upload" })).rejects.toThrow("Document is missing.");
    await expect(orchestrator.route({ stage: "provision" })).rejects.toThrow("Document is missing.");
  });

  it("requires the session job id", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    await expect(orchestrator.route({ stage: "session", file })).rejects.toThrow("Job id is missing.");
  });

  it("emits metadata completion payload from persisted store values", async () => {
    const onComplete = vi.fn();
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      onComplete,
      store: createStore(),
    });

    await orchestrator.route({ stage: "metadata" });

    expect(onComplete).toHaveBeenCalledWith({
      baseUrl: "https://storage.test",
      document: "session-1.pdf",
      indexChoices: [{ service: "Recognition", level: 5 }],
      numOfPages: 3,
      sasToken: "sas-1",
      session: "session-1",
      workflow: true,
    });
  });

  it("emits metadata completion payload with the fresh workflow state", async () => {
    const onComplete = vi.fn();
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      onComplete,
      store: createStore({ workflow: null }),
    });

    await orchestrator.route({ stage: "metadata" });

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ workflow: null }));
  });

  it("rejects unknown route stages", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });

    await expect(orchestrator.route({ stage: "bad" as never })).rejects.toThrow("Unknown intake route stage");
  });
});
