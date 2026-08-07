import { ChoiceData, CHOICESTRUCTURE } from "./choicesData";
import type {
  ChoiceValue,
  ChoicesBackendData,
  SessionDataLoadRuntime,
  ChoicesRuntime,
  ChoicesSaveResult,
} from "../type/choices.types";

function getAuthToken(runtime: Pick<ChoicesRuntime, "store">): string {
  const userToken = runtime.store.get("userToken");
  return typeof userToken === "object" && userToken !== null
    ? String((userToken as { token?: unknown }).token ?? "")
    : "";
}

export function normalizeBackendChoices(choices: ChoicesBackendData): unknown[] | null {
  if (choices == null) {
    return null;
  }
  if (Array.isArray(choices)) {
    return choices;
  }
  return Array.isArray(choices.items) ? choices.items : [];
}

export async function loadSessionData(runtime: SessionDataLoadRuntime, session: string): Promise<unknown[] | null> {
  const cached = runtime.store.get("choicesBySession");
  if (Object.hasOwn(cached, session)) {
    return cached[session] ?? null;
  }
  const jobId = crypto.randomUUID();
  runtime.onJobEvent?.({ jobId, message: "Loading session choices", phase: "started", session });
  try {
    const choices = normalizeBackendChoices(await runtime.dataWorkerClient.load(getAuthToken(runtime), session));
    runtime.store.set("choicesBySession", { ...cached, [session]: choices });
    runtime.onJobEvent?.({ jobId, message: "Session choices loaded", phase: "completed", session });
    return choices;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtime.onJobEvent?.({ error: message, jobId, message: "Session choices load failed", phase: "failed", session });
    throw error;
  }
}

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

export class ChoicesService {
  #runtime: ChoicesRuntime;

  constructor(runtime: ChoicesRuntime) {
    this.#runtime = runtime;
  }

  async load(session: string): Promise<unknown[] | null> {
    return loadSessionData(this.#runtime, session);
  }

  save(choiceJson: ChoiceValue[], alwaysReview: boolean, studioModeEnabled: boolean): ChoicesSaveResult {
    const runtime = this.#runtime;
    const previousChoices = snapshot(runtime.store.get("indexChoices"));
    const previousWorkflow = runtime.store.get("workflow");

    runtime.store.set("workflow", alwaysReview);
    runtime.store.set("indexChoices", choiceJson);
    this.applyStudioModeSetting(studioModeEnabled);

    const changed =
      snapshot(runtime.store.get("indexChoices")) !== previousChoices ||
      runtime.store.get("workflow") !== previousWorkflow;

    if (changed) {
      this.emitUpdateChoices();
    }

    return {
      choices: choiceJson,
      alwaysReview,
      studioModeEnabled: !!studioModeEnabled,
      changed,
    };
  }

  getDefaultResult() {
    return new ChoiceData(CHOICESTRUCTURE).generateDefaultResult();
  }

  applyStudioModeSetting(studioModeEnabled: boolean): void {
    const runtime = this.#runtime;
    queueMicrotask(() => runtime.eventBus.emit(runtime.events.toggleLayout, { studioModeEnabled }));
  }

  emitUpdateChoices(): void {
    this.#runtime.eventBus.emit(this.#runtime.events.updateChoices);
  }
}

export function createChoicesService(runtime: ChoicesRuntime): ChoicesService {
  return new ChoicesService(runtime);
}
