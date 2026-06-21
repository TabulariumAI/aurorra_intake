import { ChoiceData, CHOICESTRUCTURE } from "./choicesData";
import type {
  ChoiceValue,
  ChoicesBackendData,
  ChoicesRuntime,
  ChoicesSaveResult,
} from "../type/choices.types";

function getAuthToken(runtime: ChoicesRuntime): string {
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

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

export class ChoicesService {
  #runtime: ChoicesRuntime;

  constructor(runtime: ChoicesRuntime) {
    this.#runtime = runtime;
  }

  async load(session: string): Promise<unknown[] | null> {
    const token = getAuthToken(this.#runtime);
    const choices = await this.#runtime.choicesWorkerClient.load(token, session);
    return normalizeBackendChoices(choices);
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


    queueMicrotask(() => runtime.eventBus.emit(runtime.events.toggleLayout));
  }

  emitUpdateChoices(): void {
    this.#runtime.eventBus.emit(this.#runtime.events.updateChoices);
  }
}

export function createChoicesService(runtime: ChoicesRuntime): ChoicesService {
  return new ChoicesService(runtime);
}
