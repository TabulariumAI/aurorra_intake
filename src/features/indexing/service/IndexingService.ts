import type {
  IndexingRuntime,
  IndexingServiceActions,
  IndexingStatusResponse,
} from "../type/indexing.types";
import { ENRICHMENT_STEPS, PAGE_PROGRESS_STAGES } from "../config/indexing.config";
import type { ProgressJob } from "../../progressview/type/progress.types";

type ErrorLike = {
  error?: unknown;
  details?: unknown;
  message?: unknown;
};

function resolveMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorLike | null | undefined;
  for (const message of [candidate?.error, candidate?.details, candidate?.message]) {
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallbackAction: string, runtime: IndexingRuntime): string {
  const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
    [runtime.messages.ERR_ACT.args.action]: fallbackAction,
  });
  const message = resolveMessage(error, fallback);
  return message === fallback ? fallback : `${fallback} ${message}`;
}

function resolveStatusResponse(value: unknown): IndexingStatusResponse {
  if (typeof value !== "object" || value === null) {
    return { status: "error", data: String(value) };
  }

  const candidate = value as {
    status?: unknown;
    data?: unknown;
    etag?: unknown;
  };
  const status = typeof candidate.status === "string" ? candidate.status : "";
  if (status === "completed") {
    if (typeof candidate.etag !== "string" || !candidate.etag.trim()) {
      throw new Error("Indexing completed without a metadata ETag.");
    }
    return { status, data: String(candidate.data ?? ""), etag: candidate.etag };
  }
  if (status === "pending" || status === "processing" || status === "error") {
    return { status, data: String(candidate.data ?? "") };
  }

  return { status: "error", data: String(candidate.status ?? "unknown") };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* pollSteps(intervalMs: number, steps: number) {
  const stepMs = 7500;
  const budgetMs = steps * stepMs;
  for (let elapsedMs = 0; elapsedMs < budgetMs;) {
    const waitMs = Math.min(intervalMs, budgetMs - elapsedMs);
    await delay(waitMs);
    yield Math.floor(elapsedMs / stepMs);
    elapsedMs += waitMs;
  }
}

class IndexingService implements IndexingServiceActions {
  #runtime: IndexingRuntime;

  constructor(runtime: IndexingRuntime) {
    this.#runtime = runtime;
  }

  async process() {
    const runtime = this.#runtime;
    if (runtime.store.get("indexingStepStatus") === true) {
      return;
    }

    const session = runtime.store.get("session");
    const documentName = runtime.store.get("document");
    runtime.store.set("indexingStepStatus", true);
    let lastProgress: ProgressJob = { jobId: crypto.randomUUID(), message: PAGE_PROGRESS_STAGES[0], phase: "started" };

    try {
      if (!session) {
        throw new Error(runtime.alert.format(runtime.messages.SESSION_REQ_INFO));
      }

      const { choices, jurisdiction, scope } = runtime.config;
      const levels = new Map(choices.map(choice => [choice.service, choice.level]));

      const pageCount = Number(runtime.store.get("numOfPages"));
      const pages = !scope || "all" in scope ? pageCount : Math.min(pageCount, scope.first + scope.last);
      const sessionId = String(session);
      let status = await this.checkStatus(sessionId);
      if (status.status !== "completed") {
        runtime.progress.receive(lastProgress);
        await this.start(sessionId, documentName, choices, jurisdiction);

        let elapsedMs = 0;
        for (const stage of PAGE_PROGRESS_STAGES) {
          if (status.status === "completed") break;
          const jobId = stage === lastProgress.message ? lastProgress.jobId : crypto.randomUUID();
          for (let page = 1; page <= pages; page++) {
            lastProgress = {
              jobId,
              message: stage,
              phase: "started",
              progress: { completed: page, total: pages, unit: "pages" },
            };
            runtime.progress.receive(lastProgress);
            await delay(runtime.intervalPageMs);
            elapsedMs += runtime.intervalPageMs;
            if (elapsedMs >= runtime.baseIntervalMs) {
              status = await this.checkStatus(sessionId);
              elapsedMs = 0;
            }
            if (status.status === "completed") break;
          }
          if (status.status !== "completed" && pages > 0) runtime.progress.receive({ ...lastProgress, phase: "completed" });
        }

        for (const [service, message] of ENRICHMENT_STEPS) {
          if (status.status === "completed" || (levels.get(service) ?? 0) <= 0) continue;
          lastProgress = { jobId: crypto.randomUUID(), message, phase: "started" };
          runtime.progress.receive(lastProgress);
          for await (const _step of pollSteps(runtime.baseIntervalMs, 1)) {
            status = await this.checkStatus(sessionId);
            if (status.status === "completed") break;
          }
          if (status.status !== "completed") {
            runtime.progress.receive({ ...lastProgress, phase: "completed" });
          }
        }

        if (status.status !== "completed") {
          lastProgress = { jobId: crypto.randomUUID(), message: "Analyzing Index Quality", phase: "started" };
          runtime.progress.receive(lastProgress);
          for await (const _step of pollSteps(runtime.baseIntervalMs, 1)) {
            status = await this.checkStatus(sessionId);
            if (status.status === "completed") break;
          }
          if (status.status !== "completed") {
            runtime.progress.receive({ ...lastProgress, phase: "completed" });
          }
        }

        if (status.status !== "completed") {
          lastProgress = {
            jobId: crypto.randomUUID(),
            message: "Retrieving processed data...",
            phase: "started",
            progress: { completed: 0, total: 11, unit: "steps" },
          };
          runtime.progress.receive(lastProgress);
          for await (const step of pollSteps(runtime.baseIntervalMs, 11)) {
            lastProgress = { ...lastProgress, progress: { completed: step + 1, total: 11, unit: "steps" } };
            runtime.progress.receive(lastProgress);
            status = await this.checkStatus(sessionId);
            if (status.status === "completed") break;
          }
        }

        if (status.status !== "completed") {
          runtime.progress.receive({ ...lastProgress, phase: "info", progress: null });
          runtime.progress.receive({
            jobId: crypto.randomUUID(),
            message: "Processing is taking longer than expected.",
            phase: "info",
            actions: [{
              label: "View metadata",
              onConfirm: () => {
                runtime.eventBus.emit(runtime.events.reRoute, {
                  [runtime.events.reRoute.detail.stage]: "metadata",
                });
              },
              requireConfirmation: false,
              variant: "primary",
            }],
          });
          return;
        }
        runtime.progress.receive({ ...lastProgress, phase: "completed" });
      }
      if (runtime.config.iq) {
        lastProgress = { jobId: crypto.randomUUID(), message: "Generating IQ report", phase: "started" };
        runtime.progress.receive(lastProgress);
        await runtime.iqWorkerClient.generateReport(runtime.getAuthToken(), sessionId);
        runtime.progress.receive({ ...lastProgress, phase: "completed" });
      }
      if (runtime.config.document) {
        lastProgress = { jobId: crypto.randomUUID(), message: "Generating the image package", phase: "started" };
        runtime.progress.receive(lastProgress);
        await runtime.imageWorkerClient.generatePackage(runtime.getAuthToken(), sessionId);
        runtime.progress.receive({ ...lastProgress, phase: "completed" });
      }
      runtime.onIndexed({ session: sessionId, document: String(documentName), etag: status.etag });
      runtime.eventBus.emit(runtime.events.reRoute, {
        [runtime.events.reRoute.detail.stage]: "metadata",
      });
    } catch (error) {
      console.error("[Intake:indexing]", error);
      const message = getErrorMessage(error, "document processing", runtime);
      runtime.progress.receive({ ...lastProgress, error: message, phase: "failed" });
    } finally {
      runtime.store.set("indexingStepStatus", false);
    }
  }

  async start(session: string, name: unknown, choices: unknown, jurisdiction: string | null) {
    const runtime = this.#runtime;
    const token = runtime.getAuthToken();
    if (!token) {
      throw new Error("Missing auth token");
    }

    const documentName = String(name);
    if (!Array.isArray(choices)) {
      throw new Error("Index choices are not available.");
    }
    await runtime.indexingWorkerClient.start(token, session, documentName, choices, jurisdiction);
  }

  async checkStatus(session: string) {
    const runtime = this.#runtime;
    const token = runtime.getAuthToken();
    if (!token) {
      throw new Error("Missing auth token");
    }

    try {
      const response = await runtime.indexingWorkerClient.status(token, session);
      const data = resolveStatusResponse(response);
      if (data.status === "error") {
        throw new Error(data.data);
      }
      return data;
    } catch (error) {
      console.error("[Intake:indexing]", error);
      const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "document processing",
      });
      throw new Error(resolveMessage(error, fallback), { cause: error });
    }
  }
}

export function createIndexingService(runtime: IndexingRuntime): IndexingServiceActions {
  return new IndexingService(runtime);
}
