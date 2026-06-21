import { useState } from "react";
import { ChoiceData } from "../service/choicesData";
import type { ChoiceFormSubmitPayload, ChoiceStructure, ChoiceValue } from "../type/choices.types";

type Intent = 0 | 1;

type ChoiceFormState = {
  radioLevels: Record<string, number>;
  intents: Record<string, Intent>;
  checked: Record<string, boolean>;
  alwaysReview: boolean;
  studioModeEnabled: boolean;
  dirty: boolean;
};

type ChoiceFormController = ChoiceFormState & {
  setRadioLevel(choiceName: string, level: number): void;
  setCheckboxIntent(serviceId: string, checked: boolean): void;
  setAlwaysReview(checked: boolean): void;
  setStudioModeEnabled(checked: boolean): void;
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

function buildInitialState(
  structure: ChoiceStructure,
  choicesJson: unknown,
  alwaysReview: boolean,
  studioModeEnabled: boolean,
): ChoiceFormState {
  const data = new ChoiceData(structure);
  const items = getItems(structure);
  const intents: Record<string, Intent> = {};
  const radioLevels: Record<string, number> = {};

  for (const item of items) {
    intents[item.name] = 0;
  }

  if (isUsableChoices(choicesJson)) {
    const selected = new Set(choicesJson.map((entry) => entry.service).filter(Boolean));
    for (const item of items) {
      intents[item.name] = !item.system && selected.has(item.name) ? 1 : 0;
    }
    for (const entry of choicesJson) {
      const choice = structure.choices.find((candidate) => candidate.name === entry.service);
      if (choice?.options) {
        radioLevels[choice.name] = data.getNumericValue(entry.level);
      }
    }
  } else {
    for (const item of items) {
      intents[item.name] = !item.system && item.default ? 1 : 0;
    }
    for (const choice of structure.choices) {
      if (choice.options) {
        radioLevels[choice.name] = data.getNumericValue(choice.default ?? "None");
      }
    }
  }

  return {
    radioLevels,
    intents,
    checked: recomputeChecked(structure, intents),
    alwaysReview: !!alwaysReview,
    studioModeEnabled: !!studioModeEnabled,
    dirty: false,
  };
}

function extractChoices(structure: ChoiceStructure, state: ChoiceFormState): ChoiceValue[] {
  const data = new ChoiceData(structure);
  const result: ChoiceValue[] = [];

  for (const choice of structure.choices) {
    if (choice.options) {
      result.push({
        service: choice.name,
        level: data.getNumericValue(state.radioLevels[choice.name] ?? 0),
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
  initialAlwaysReview: boolean,
  initialStudioModeEnabled: boolean,
): ChoiceFormController {
  const createInitial = () => buildInitialState(structure, initialChoices, initialAlwaysReview, initialStudioModeEnabled);
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
    setAlwaysReview(checked) {
      setState((current) => ({
        ...current,
        alwaysReview: checked,
        dirty: true,
      }));
    },
    setStudioModeEnabled(checked) {
      setState((current) => ({
        ...current,
        studioModeEnabled: checked,
        dirty: true,
      }));
    },
    reset() {
      setState(createInitial());
    },
    submit() {
      return {
        choices: extractChoices(structure, state),
        alwaysReview: state.alwaysReview,
        studioModeEnabled: state.studioModeEnabled,
      };
    },
  };
}

export { humanizeName };
