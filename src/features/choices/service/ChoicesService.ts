import { ChoiceData, CHOICESTRUCTURE } from "./choicesData";
import type {
  ChoiceValue,
  SessionChoices,
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

export function normalizeBackendChoices(choices: ChoicesBackendData): SessionChoices | null {
  if (choices == null) {
    return null;
  }
  return {
    items: new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues(choices),
    jurisdiction: Array.isArray(choices) ? null : choices.jurisdiction ?? null,
  };
}

export async function loadSessionData(runtime: SessionDataLoadRuntime, session: string): Promise<SessionChoices | null> {
  const cached = runtime.store.get("choicesBySession");
  if (Object.hasOwn(cached, session)) {
    const choices = normalizeBackendChoices(cached[session] ?? null);
    runtime.store.set("choicesBySession", { ...cached, [session]: choices });
    return choices;
  }
  const choices = normalizeBackendChoices(await runtime.dataWorkerClient.load(getAuthToken(runtime), session));
  runtime.store.set("choicesBySession", { ...runtime.store.get("choicesBySession"), [session]: choices });
  return choices;
}

export class ChoicesService {
  #runtime: ChoicesRuntime;

  constructor(runtime: ChoicesRuntime) {
    this.#runtime = runtime;
  }

  save(choiceJson: ChoiceValue[], workflow: WorkflowSettings, jurisdiction: string | null): ChoicesSaveResult {
    const runtime = this.#runtime;
    const previousJurisdiction = runtime.store.get("jurisdiction");
    const previousChoices = JSON.stringify(runtime.store.get("indexChoices"));
    const previousWorkflow = JSON.stringify(runtime.store.get("workflow"));
    const normalizedWorkflow = normalizeWorkflowSettings(workflow);

    runtime.store.set("jurisdiction", jurisdiction);
    runtime.store.set("workflow", normalizedWorkflow);
    runtime.store.set("indexChoices", choiceJson);
    const changed = jurisdiction !== previousJurisdiction ||
      JSON.stringify(runtime.store.get("indexChoices")) !== previousChoices ||
      JSON.stringify(runtime.store.get("workflow")) !== previousWorkflow;

    if (changed) {
      runtime.eventBus.emit(runtime.events.updateChoices);
    }

    return {
      choices: choiceJson,
      jurisdiction,
      workflow: normalizedWorkflow,
      changed,
    };
  }
}

export function createChoicesService(runtime: ChoicesRuntime): ChoicesService {
  return new ChoicesService(runtime);
}
