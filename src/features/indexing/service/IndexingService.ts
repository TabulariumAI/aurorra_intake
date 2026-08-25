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

const PAGE_SERVICES = [
  "ConfidentialIndexing",
  "TransactionIndexing",
  "EndorsementIndexing",
  "PartyClauseIndexing",
  "RecitalIndexing",
  "ExhibitIndexing",
  "MonetaryInfoIndexing",
  "AcknowledgmentIndexing",
  "CourtIndexing",
  "VitalIndexing",
] as const;

const ENRICHMENT_STEPS = [
  ["LegalEnrichment", "Enriching legal descriptions"],
  ["PartyEnrichment", "Enriching party information"],
  ["Validation", "Validating document data"],
] as const;

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

  async process() {
    const runtime = this.#runtime;
    if (runtime.store.get("indexingStepStatus") === true) {
      return;
    }

    runtime.store.set("indexingStepStatus", true);
    let isComplete = false;
    let lastJobId = crypto.randomUUID();
    let lastMessage = "Identifying pages";
    runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });

    try {
      const session = runtime.store.get("session");
      if (!session) {
        throw new Error(runtime.alert.format(runtime.messages.SESSION_REQ_INFO));
      }

      const choices = normalizeChoices(runtime.store.get("indexChoices"), runtime);
      runtime.store.set("indexChoices", choices);
      const choicesBySession = runtime.store.get("choicesBySession");
      runtime.store.set("choicesBySession", { ...choicesBySession, [String(session)]: choices });
      const levels = new Map<string, number>();
      for (const choice of choices) {
        if (typeof choice !== "object" || choice === null) continue;
        const { level, service } = choice as { level?: unknown; service?: unknown };
        if (typeof service === "string" && typeof level === "number") {
          levels.set(service, level);
        }
      }

      const documentName = runtime.store.get("document");
      const pages = runtime.choices.getActualPages(
        choices,
        runtime.store.get("numOfPages"),
      );
      const sessionId = String(session);
      const pageSegments = PAGE_SERVICES.filter((service) => (levels.get(service) ?? 0) > 0).length;
      const pageIntervalMs = runtime.baseIntervalMs + 50 * pageSegments;
      await delay(runtime.baseIntervalMs);
      isComplete = await this.checkStatus(sessionId);

      if (!isComplete) {
        lastJobId = crypto.randomUUID();
        lastMessage = "Refining document";
        runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });
        await this.start(sessionId, documentName, choices);
        await delay(runtime.baseIntervalMs);
        isComplete = await this.checkStatus(sessionId);
      }

      if (!isComplete) {
        lastJobId = crypto.randomUUID();
        lastMessage = "Recognizing document";
        runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });
        await delay(runtime.baseIntervalMs);
        isComplete = await this.checkStatus(sessionId);
      }

      if (!isComplete) {
        for (let page = 1; page <= pages; page++) {
          lastJobId = crypto.randomUUID();
          lastMessage = `Processing page ${page} of ${pages}`;
          runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });
          await delay(pageIntervalMs);
          isComplete = await this.checkStatus(sessionId);
          if (isComplete) {
            break;
          }
        }
      }

      for (const [service, message] of ENRICHMENT_STEPS) {
        if (isComplete || (levels.get(service) ?? 0) <= 0) continue;
        lastJobId = crypto.randomUUID();
        lastMessage = message;
        runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });
        await delay(runtime.baseIntervalMs);
        isComplete = await this.checkStatus(sessionId);
      }

      if (!isComplete) {
        lastJobId = crypto.randomUUID();
        lastMessage = "Analyzing Index Quality";
        runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });
        await delay(runtime.baseIntervalMs);
      }

      if (!isComplete) {
        lastJobId = crypto.randomUUID();
        lastMessage = "Retrieving processed data...";
        runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "started" });
        let attempts = 0;
        while (!isComplete && attempts < 11) {
          await delay(runtime.baseIntervalMs);
          isComplete = await this.checkStatus(sessionId);
          attempts += 1;
        }
      }

      if (!isComplete) {
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
      runtime.progress.receive({ jobId: lastJobId, message: lastMessage, phase: "completed" });
    } catch (error) {
      const message = getErrorMessage(error, "document processing", runtime);
      runtime.progress.receive({ error: message, jobId: lastJobId, message: lastMessage, phase: "failed" });
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
    await runtime.indexingWorkerClient.start(token, session, documentName, choices);
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
      throw new Error(resolveMessage(error, fallback), { cause: error });
    }
  }
}

export function createIndexingService(runtime: IndexingRuntime): IndexingServiceActions {
  return new IndexingService(runtime);
}
