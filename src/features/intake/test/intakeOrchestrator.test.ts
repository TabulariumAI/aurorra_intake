import { describe, expect, it, vi } from "vitest";
import { createIntakeOrchestrator } from "../service/intakeOrchestrator";
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
    });

    await expect(orchestrator.route({ stage: "session" })).rejects.toThrow("Document is missing.");
    await expect(orchestrator.route({ stage: "upload" })).rejects.toThrow("Document is missing.");
  });

  it("requires the session job id", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
    });
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    await expect(orchestrator.route({ stage: "session", file })).rejects.toThrow("Job id is missing.");
  });

  it("requires an explicit route stage", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
    });

    await expect(orchestrator.route({} as never)).rejects.toThrow("Unknown intake route stage: undefined");
  });

  it("rejects routes whose service is not ready", async () => {
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
    });

    await expect(orchestrator.route({ stage: "session", file, jobId: "job-1" })).rejects.toThrow("Session service is not ready.");
    await expect(orchestrator.route({ stage: "upload", file })).rejects.toThrow("Upload service is not ready.");
    await expect(orchestrator.route({ stage: "provision" })).rejects.toThrow("Provision service is not ready.");
    await expect(orchestrator.route({ stage: "indexing" })).rejects.toThrow("Indexing service is not ready.");
  });

  it("forwards the captured completion instead of reading the currently selected session", async () => {
    const onComplete = vi.fn();
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
      onComplete,
    });

    await orchestrator.route({ stage: "metadata", completion: { batch: null, group: null, session: "indexed-session", etag: "indexed-etag", data: { baseUrl: "https://storage/indexed", document: "indexed.pdf", numOfPages: 4, sasToken: "indexed-sas" } } });

    expect(onComplete).toHaveBeenCalledExactlyOnceWith({ batch: null, group: null, session: "indexed-session", etag: "indexed-etag", data: { baseUrl: "https://storage/indexed", document: "indexed.pdf", numOfPages: 4, sasToken: "indexed-sas" } });
  });

  it("rejects unknown route stages", async () => {
    const orchestrator = createIntakeOrchestrator({
      getServices: () => ({ session: null, upload: null, provision: null, indexing: null }),
    });

    await expect(orchestrator.route({ stage: "bad" as never })).rejects.toThrow("Unknown intake route stage");
  });
});
