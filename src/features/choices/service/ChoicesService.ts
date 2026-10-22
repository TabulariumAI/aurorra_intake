import { ChoiceData, CHOICESTRUCTURE, normalizeWorkflowSettings } from "./choicesData";
import type {
  ChoiceValue,
  SessionChoices,
  ChoicesBackendData,
  SessionDataLoadRuntime,
  ChoicesRuntime,
  ChoicesSaveResult,
  WorkflowSettings,
} from "../type/choices.types";
import { createStoreAdapter, setRuntimeAuthToken } from "../../../store/adapter/storeAdapter";

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
  setRuntimeAuthToken(runtime.authToken);
  const choices = normalizeBackendChoices(await runtime.dataWorkerClient.load(runtime.authToken, session));
  const store = createStoreAdapter();
  const stored = structuredClone(choices);
  store.set("choicesBySession", { ...store.get("choicesBySession"), [session]: stored });
  if (stored !== null && store.get("session") === session) {
    store.set("indexChoices", stored.items);
    store.set("jurisdiction", stored.jurisdiction);
  }
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
    const choices = structuredClone(choiceJson);
    runtime.store.set("indexChoices", choices);
    const session = runtime.store.get("session");
    if (typeof session === "string" && session) {
      runtime.store.set("choicesBySession", {
        ...runtime.store.get("choicesBySession"),
        [session]: { items: choices, jurisdiction },
      });
    }
    const changed = jurisdiction !== previousJurisdiction ||
      JSON.stringify(runtime.store.get("indexChoices")) !== previousChoices ||
      JSON.stringify(runtime.store.get("workflow")) !== previousWorkflow;

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
