import { DEFAULT_WORKFLOW_SETTINGS, workflowValue } from "../service/choicesData";
import type {
  ChoiceFormSubmitPayload,
  ChoiceStructure,
  ChoiceValue,
  WorkflowSettingName,
  WorkflowSettings,
} from "../type/choices.types";
import { ChoiceData } from "../service/choicesData";
import { useState } from "react";

type Intent = 0 | 1;

type ChoiceFormState = {
  radioLevels: Record<string, number>;
  intents: Record<string, Intent>;
  checked: Record<string, boolean>;
  workflow: Record<WorkflowSettingName, boolean>;
  dirty: boolean;
};

type ChoiceFormController = ChoiceFormState & {
  setRadioLevel(choiceName: string, level: number): void;
  setCheckboxIntent(serviceId: string, checked: boolean): void;
  setWorkflowValue(name: WorkflowSettingName, checked: boolean): void;
  reset(): void;
  submit(): ChoiceFormSubmitPayload;
};

function humanizeName(name: string): string {
  return String(name).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function parseDependencies(depStr: string | undefined): Array<{ id: string; value: number }> {
  if (!depStr) return [];
  return depStr
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [id, value] = part.split(":");
      return { id: id.trim(), value: Number(value) || 0 };
    });
}

function getItems(structure: ChoiceStructure) {
  return structure.choices.flatMap((choice) =>
    (choice.items ?? []).map((item) => ({
      ...item,
      groupName: choice.name,
    })),
  );
}

function buildDependantsMap(structure: ChoiceStructure): Record<string, string[]> {
  const dependants: Record<string, string[]> = {};
  for (const item of getItems(structure)) {
    for (const dependency of parseDependencies(item.dependency)) {
      if (!dependants[dependency.id]) {
        dependants[dependency.id] = [];
      }
      dependants[dependency.id].push(item.name);
    }
  }
  return dependants;
}

function recomputeChecked(structure: ChoiceStructure, intents: Record<string, Intent>): Record<string, boolean> {
  const items = getItems(structure);
  const itemNames = new Set(items.map((item) => item.name));
  const dependants = buildDependantsMap(structure);
  const checked: Record<string, boolean> = {};

  for (const item of items) {
    checked[item.name] = false;
  }

  const maxIterations = items.length * 4 + 6;
  for (let index = 0; index < maxIterations; index += 1) {
    let changed = false;
    const next: Record<string, boolean> = {};
    for (const item of items) {
      const children = dependants[item.name] ?? [];
      const childCount = children.reduce((total, child) => total + (itemNames.has(child) && checked[child] ? 1 : 0), 0);
      next[item.name] = ((item.system ? 0 : intents[item.name] ?? 0) + childCount) >= 1;
    }
    for (const item of items) {
      if (checked[item.name] !== next[item.name]) {
        changed = true;
      }
      checked[item.name] = next[item.name];
    }
    if (!changed) {
      break;
    }
  }

  return checked;
}

function isUsableChoices(value: unknown): value is ChoiceValue[] {
  return Array.isArray(value) && value.length > 0 && value.some((entry) => entry && typeof entry.service === "string");
}

function workflowToState(settings: WorkflowSettings): Record<WorkflowSettingName, boolean> {
  return DEFAULT_WORKFLOW_SETTINGS.reduce((next, setting) => {
    next[setting.name] = workflowValue(settings, setting.name);
    return next;
  }, {} as Record<WorkflowSettingName, boolean>);
}

function buildInitialState(
  structure: ChoiceStructure,
  choicesJson: unknown,
  initialWorkflow: WorkflowSettings,
): ChoiceFormState {
  const data = new ChoiceData(structure);
  const items = getItems(structure);
  const intents: Record<string, Intent> = {};
  const radioLevels: Record<string, number> = {};
  for (const item of items) {
    intents[item.name] = 0;
  }

  const choiceValues = data.normalizeChoiceValues(choicesJson) as ChoiceValue[];
  for (const item of items) {
    intents[item.name] = !item.system && choiceValues.some((entry) => entry.service === item.name && entry.level > 0) ? 1 : 0;
  }
  for (const item of structure.choices) {
    if (item.options) {
      const match = choiceValues.find((entry) => entry.service === item.name);
      if (match) {
        radioLevels[item.name] = match.level;
      } else if (item.default != null) {
        radioLevels[item.name] = parseInt(String(item.default), 10);
      }
    } else if (item.default !== undefined) {
      intents[item.name] = item.default ? 1 : intents[item.name];
    }
  }
  for (const choice of choiceValues) {
    if (!choice?.service) continue;
    for (const item of items) {
      if (item.name === choice.service) {
        radioLevels[choice.service] = choice.level;
      }
    }
  }
  return {
    radioLevels,
    intents,
    checked: recomputeChecked(structure, intents),
    workflow: workflowToState(initialWorkflow),
    dirty: false,
  };
}

function extractChoices(structure: ChoiceStructure, state: ChoiceFormState): ChoiceValue[] {
  const result: ChoiceValue[] = [];

  for (const choice of structure.choices) {
    if (choice.options) {
      result.push({
        service: choice.name,
        level: state.radioLevels[choice.name] ?? 0,
      });
    } else if (choice.items) {
      for (const item of choice.items) {
        if (state.checked[item.name]) {
          result.push({ service: item.name, level: 1 });
        }
      }
    } else {
      result.push({
        service: choice.name,
        level: state.checked[choice.name] ? 1 : 0,
      });
    }
  }

  return result;
}

function extractWorkflow(state: ChoiceFormState): WorkflowSettings {
  return DEFAULT_WORKFLOW_SETTINGS.map((setting) => ({
    ...setting,
    value: state.workflow[setting.name] ?? setting.value,
  }));
}

export function getChoiceItemSum(structure: ChoiceStructure, serviceId: string, state: Pick<ChoiceFormState, "checked" | "intents">): number {
  const item = getItems(structure).find((candidate) => candidate.name === serviceId);
  const own = item?.system ? 0 : state.intents[serviceId] ?? 0;
  const children = buildDependantsMap(structure)[serviceId] ?? [];
  return own + children.reduce((total, child) => total + (state.checked[child] ? 1 : 0), 0);
}

export function getChoiceItemDependants(structure: ChoiceStructure, serviceId: string): string[] {
  return buildDependantsMap(structure)[serviceId] ?? [];
}

export function useChoiceForm(
  structure: ChoiceStructure,
  initialChoices: unknown,
  initialWorkflow: WorkflowSettings,
): ChoiceFormController {
  const createInitial = () => buildInitialState(structure, initialChoices, initialWorkflow);
  const [state, setState] = useState<ChoiceFormState>(createInitial);

  return {
    ...state,
    setRadioLevel(choiceName, level) {
      setState((current) => ({
        ...current,
        radioLevels: {
          ...current.radioLevels,
          [choiceName]: level,
        },
        dirty: true,
      }));
    },
    setCheckboxIntent(serviceId, checked) {
      setState((current) => {
        const intents = {
          ...current.intents,
          [serviceId]: checked ? 1 as Intent : 0 as Intent,
        };
        return {
          ...current,
          intents,
          checked: recomputeChecked(structure, intents),
          dirty: true,
        };
      });
    },
    setWorkflowValue(name, checked) {
      setState((current) => ({
        ...current,
        workflow: {
          ...current.workflow,
          [name]: checked,
        },
        dirty: true,
      }));
    },
    reset() {
      setState(createInitial());
    },
    submit() {
      return {
        choices: extractChoices(structure, state),
        workflow: extractWorkflow(state),
      };
    },
  };
}

export { humanizeName };
