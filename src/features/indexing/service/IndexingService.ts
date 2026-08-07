import type {
  IndexingRuntime,
  IndexingServiceActions,
  IndexingStatusResponse,
} from "../type/indexing.types";

type ErrorLike = {
  error?: unknown;
  details?: unknown;
  message?: unknown;
};

function resolveMessage(error: unknown, fallback: string): string {
  const candidate = error as ErrorLike | null | undefined;
  const message = candidate?.error;
  if (typeof message === "string") {
    return message;
  }
  if (typeof candidate?.details === "string") {
    return candidate.details;
  }
  if (typeof candidate?.message === "string") {
    return candidate.message;
  }

  return fallback;
}

function getErrorMessage(error: unknown, fallbackAction: string, runtime: IndexingRuntime): string {
  const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
    [runtime.messages.ERR_ACT.args.action]: fallbackAction,
  });
  return resolveMessage(error, fallback);
}

function resolveStatusResponse(value: unknown): IndexingStatusResponse {
  if (typeof value !== "object" || value === null) {
    return { status: "error", data: String(value) };
  }

  const candidate = value as {
    status?: unknown;
    data?: unknown;
  };
  const status = typeof candidate.status === "string" ? candidate.status : "";
  if (status === "pending" || status === "processing" || status === "completed" || status === "error") {
    return { status, data: String(candidate.data ?? "") };
  }

  return { status: "error", data: String(candidate.status ?? "unknown") };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeChoices(value: unknown, runtime: IndexingRuntime): unknown[] {
  const choices = runtime.choices.normalizeChoices(value, runtime.choiceStructure);
  if (!Array.isArray(choices)) {
    throw new Error("Index choices are not available.");
  }
  return choices;
}

class IndexingService implements IndexingServiceActions {
  #runtime: IndexingRuntime;

  constructor(runtime: IndexingRuntime) {
    this.#runtime = runtime;
  }

  #pageInterval(pages: number, intervalValue: number) {
    if (pages < 3) return intervalValue + (150 * pages);
    if (pages < 5) return intervalValue + (100 * pages);
    if (pages < 10) return intervalValue + (50 * pages);
    return intervalValue + (25 * pages);
  }

  async process() {
    const runtime = this.#runtime;
    if (runtime.store.get("indexingStepStatus") === true) {
      return;
    }

    runtime.store.set("indexingStepStatus", true);
    let isComplete = false;
    let cycleInterval = runtime.baseIntervalMs;

    try {
      const session = runtime.store.get("session");
      if (!session) {
        throw new Error(runtime.alert.format(runtime.messages.SESSION_REQ_INFO));
      }

      const choices = normalizeChoices(runtime.store.get("indexChoices"), runtime);
      runtime.store.set("indexChoices", choices);
      const choicesBySession = runtime.store.get("choicesBySession");
      runtime.store.set("choicesBySession", { ...choicesBySession, [String(session)]: choices });

      const documentName = runtime.store.get("document");
      const pages = runtime.choices.getActualPages(
        choices,
        runtime.store.get("numOfPages"),
      );
      const sessionId = String(session);
      const statusJobId = crypto.randomUUID();
      runtime.onJobEvent?.({ jobId: statusJobId, message: "Processing document", phase: "started", session: sessionId });
      try {
        isComplete = await this.checkStatus(sessionId);
        if (!isComplete) {
          await delay(cycleInterval);
        }

        isComplete = await this.checkStatus(sessionId);
        if (!isComplete) {
          await this.start(sessionId, documentName, choices);
          cycleInterval = this.#pageInterval(pages, cycleInterval) * 3;
          await delay(cycleInterval);
          isComplete = await this.checkStatus(sessionId);
        }

        if (!isComplete) {
          const indexStatuses = runtime.choices.getIdentifyingIndexes(choices, runtime.choiceStructure);
          for (let page = 1; page <= pages; page++) {
            cycleInterval = runtime.baseIntervalMs * indexStatuses.length;
            await delay(cycleInterval);
            isComplete = await this.checkStatus(sessionId);
            if (isComplete) {
              break;
            }
          }
        }

        if (!isComplete) {
          const enrichmentStatuses = runtime.choices.getIdEnh(choices, runtime.choiceStructure);
          cycleInterval = runtime.baseIntervalMs * enrichmentStatuses.length;
          await delay(cycleInterval);
          isComplete = await this.checkStatus(sessionId);
        }

        if (!isComplete) {
          let attempts = 0;
          cycleInterval = runtime.baseIntervalMs * 2;
          await delay(cycleInterval);
          while (!isComplete && attempts < 27) {
            isComplete = await this.checkStatus(sessionId);
            if (isComplete) {
              break;
            }
            attempts += 1;
            await delay(cycleInterval);
          }
        }

        if (!isComplete) {
          throw new Error(runtime.alert.format(runtime.messages.REPORT_WAIT));
        }
        runtime.onJobEvent?.({ jobId: statusJobId, message: "Document processed", phase: "completed", session: sessionId });
      } catch (error) {
        const message = getErrorMessage(error, "document processing", runtime);
        runtime.onJobEvent?.({ error: message, jobId: statusJobId, message: "Document processing failed", phase: "failed", session: sessionId });
        throw error;
      }

    } catch (error) {
      const message = getErrorMessage(error, "processing request", runtime);
      runtime.eventBus.emit(runtime.events.showAlert, { message });
      console.error("Step4:", message);

    } finally {

      runtime.store.set("indexingStepStatus", false);
      if (isComplete) {
        runtime.eventBus.emit(runtime.events.reRoute, {
          [runtime.events.reRoute.detail.stage]: "metadata",
        });
      }
    }
  }

  async start(session: string, name: unknown, choices: unknown) {
    const runtime = this.#runtime;
    const token = runtime.getAuthToken();
    if (!token) {
      throw new Error("Missing auth token");
    }

    const documentName = String(name);
    if (!Array.isArray(choices)) {
      throw new Error("Index choices are not available.");
    }
    const jobId = crypto.randomUUID();
    runtime.onJobEvent?.({ jobId, message: "Starting document indexing", phase: "started", session });
    try {
      await runtime.indexingWorkerClient.start(token, session, documentName, choices);
      runtime.onJobEvent?.({ jobId, message: "Document indexing started", phase: "completed", session });
    } catch (error) {
      const message = resolveMessage(error, "Document indexing start failed.");
      runtime.onJobEvent?.({ error: message, jobId, message: "Document indexing start failed", phase: "failed", session });
      throw error;
    }
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
      if (data.status === "completed") {
        return true;
      }
      if (data.status === "error") {
        throw new Error(data.data);
      }
      return false;
    } catch (error) {
      const fallback = runtime.alert.format(runtime.messages.ERR_ACT, {
        [runtime.messages.ERR_ACT.args.action]: "document processing",
      });
      const message = resolveMessage(error, fallback);
      throw new Error(`${fallback} ${message}`, { cause: error });
    }
  }
}

export function createIndexingService(runtime: IndexingRuntime): IndexingServiceActions {
  return new IndexingService(runtime);
}
