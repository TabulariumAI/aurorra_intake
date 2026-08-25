import { describe, expect, it, vi } from "vitest";
import { createIntakeOrchestrator } from "../service/intakeOrchestrator";
import type { StoreAdapter } from "../../../store/type/store.types";

function createStore(seed: Record<string, unknown> = {}): StoreAdapter {
  const values = {
    baseUrl: "https://storage.test",
    document: "session-1.pdf",
    numOfPages: 3,
    sasToken: "sas-1",
    session: "session-1",
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
    await orchestrator.route({ stage: "provision" });
    await orchestrator.route({ stage: "indexing" });

    expect(services.session.process).toHaveBeenCalledWith(file, "job-1");
    expect(services.upload.process).toHaveBeenCalledWith(file);
    expect(services.provision.process).toHaveBeenCalledTimes(1);
    expect(services.indexing.process).toHaveBeenCalledTimes(1);
  });

  it("requires a document for session and upload stages", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });

    await expect(orchestrator.route({ stage: "session" })).rejects.toThrow("Document is missing.");
    await expect(orchestrator.route({ stage: "upload" })).rejects.toThrow("Document is missing.");
  });

  it("requires the session job id", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    await expect(orchestrator.route({ stage: "session", file })).rejects.toThrow("Job id is missing.");
  });

  it("requires an explicit route stage", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });

    await expect(orchestrator.route({} as never)).rejects.toThrow("Unknown intake route stage: undefined");
  });

  it("rejects routes whose service is not ready", async () => {
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });

    await expect(orchestrator.route({ stage: "session", file, jobId: "job-1" })).rejects.toThrow("Session service is not ready.");
    await expect(orchestrator.route({ stage: "upload", file })).rejects.toThrow("Upload service is not ready.");
    await expect(orchestrator.route({ stage: "provision" })).rejects.toThrow("Provision service is not ready.");
    await expect(orchestrator.route({ stage: "indexing" })).rejects.toThrow("Indexing service is not ready.");
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
      batch: null,
      data: {
        baseUrl: "https://storage.test",
        document: "session-1.pdf",
        numOfPages: 3,
        sasToken: "sas-1",
      },
      group: null,
      session: "session-1",
    });
  });

  it("emits null when metadata completion has no session", async () => {
    const onComplete = vi.fn();
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      onComplete,
      store: createStore({ session: null }),
    });

    await orchestrator.route({ stage: "metadata" });

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ session: null }));
  });

  it("rejects unknown route stages", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      store: createStore(),
    });

    await expect(orchestrator.route({ stage: "bad" as never })).rejects.toThrow("Unknown intake route stage");
  });
});
