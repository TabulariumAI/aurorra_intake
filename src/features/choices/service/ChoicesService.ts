import { ChoiceData, CHOICESTRUCTURE } from "./choicesData";
import type {
  ChoiceValue,
  ChoicesBackendData,
  SessionDataLoadRuntime,
  ChoicesRuntime,
  ChoicesSaveResult,
  WorkflowSettings,
} from "../type/choices.types";
import { normalizeWorkflowSettings } from "./choicesData";

function getAuthToken(runtime: Pick<ChoicesRuntime, "store">): string {
  const userToken = runtime.store.get("userToken");
  return typeof userToken === "object" && userToken !== null
    ? String((userToken as { token?: unknown }).token ?? "")
    : "";
}

export function normalizeBackendChoices(choices: ChoicesBackendData): ChoiceValue[] | null {
  if (choices == null) {
    return null;
  }
  return new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues(choices);
}

export async function loadSessionData(runtime: SessionDataLoadRuntime, session: string): Promise<ChoiceValue[] | null> {
  const cached = runtime.store.get("choicesBySession");
  if (Object.hasOwn(cached, session)) {
    const choices = normalizeBackendChoices(cached[session] ?? null);
    runtime.store.set("choicesBySession", { ...cached, [session]: choices });
    return choices;
  }
  const choices = normalizeBackendChoices(await runtime.dataWorkerClient.load(getAuthToken(runtime), session));
  runtime.store.set("choicesBySession", { ...cached, [session]: choices });
  return choices;
}

export class ChoicesService {
  #runtime: ChoicesRuntime;

  constructor(runtime: ChoicesRuntime) {
    this.#runtime = runtime;
  }

  save(choiceJson: ChoiceValue[], workflow: WorkflowSettings): ChoicesSaveResult {
    const runtime = this.#runtime;
    const previousChoices = JSON.stringify(runtime.store.get("indexChoices"));
    const previousWorkflow = JSON.stringify(runtime.store.get("workflow"));
    const normalizedWorkflow = normalizeWorkflowSettings(workflow);

    runtime.store.set("workflow", normalizedWorkflow);
    runtime.store.set("indexChoices", choiceJson);
    const changed =
      JSON.stringify(runtime.store.get("indexChoices")) !== previousChoices ||
      JSON.stringify(runtime.store.get("workflow")) !== previousWorkflow;

    if (changed) {
      runtime.eventBus.emit(runtime.events.updateChoices);
    }

    return {
      choices: choiceJson,
      workflow: normalizedWorkflow,
      changed,
    };
  }
}

export function createChoicesService(runtime: ChoicesRuntime): ChoicesService {
  return new ChoicesService(runtime);
}
