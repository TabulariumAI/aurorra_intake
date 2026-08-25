import type {
  ProvisionRuntime,
  ProvisionResult,
  ProvisionServiceActions,
} from "../type/provision.types";

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
  #provisionWorkerClient: ProvisionRuntime["provisionWorkerClient"];

  constructor(runtime: ProvisionRuntime) {
    this.#runtime = runtime;
    this.#provisionWorkerClient = runtime.provisionWorkerClient;
  }

  async process() {
    const runtime = this.#runtime;

    if (runtime.store.get("provisionStepStatus") === true) {
      return;
    }

    runtime.store.set("provisionStepStatus", true);
    const jobId = crypto.randomUUID();
    runtime.progress.receive({ jobId, message: "Reviewing your document", phase: "started" });

    try {
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

      const response = await this.#provisionWorkerClient.provision(
        token,
        String(session),
        String(documentName),
      );
      const result = normalizeProvisionResponse(response);

      runtime.store.set("numOfPages", result.pageNum);
      runtime.progress.receive({ jobId, message: "Reviewing your document", phase: "completed" });
      const screeningJobId = crypto.randomUUID();
      runtime.progress.receive({ jobId: screeningJobId, message: "Screening complete", phase: "started" });
      runtime.progress.receive({
        detail: {
          actions: [
            {
              label: "Continue",
              onConfirm: () => {
                runtime.progress.receive({ jobId: screeningJobId, message: "Screening complete", phase: "completed" });
                runtime.progress.receive({ jobId: crypto.randomUUID(), message: "Confirmation received", phase: "started" });
                runtime.eventBus.emit(runtime.events.reRoute, {
                  [runtime.events.reRoute.detail.stage]: "indexing",
                });
              },
              requireConfirmation: false,
              variant: "primary",
            },
            {
              label: "Cancel and Restart",
              onConfirm: runtime.restart,
              requireConfirmation: true,
              variant: "secondary",
            },
          ],
          description: String(result.description),
          summary: result.accepted
            ? "A comprehensive analysis of this document will now be performed to classify and extract all required information."
            : "We can still process it; if no matching data is found, the result will simply be empty.",
        },
        jobId: screeningJobId,
        message: "Screening complete",
        phase: "completed",
      });
    } catch (error) {
      const message = getErrorMessage(error, "Document screening failed.");
      runtime.progress.receive({ error: message, jobId, message: "Reviewing your document", phase: "failed" });
    } finally {
      runtime.store.set("provisionStepStatus", false);
    }
  }

}

export function createProvisionService(runtime: ProvisionRuntime): ProvisionServiceActions {
  return new ProvisionService(runtime);
}
