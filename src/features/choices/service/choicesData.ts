import type {
  ChoiceResult,
  ChoiceStructure,
  ChoiceValue,
  WorkflowSetting,
  WorkflowSettingName,
  WorkflowSettings,
} from "../type/choices.types";

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = [
  { name: "Review", label: "Review Before Index", value: false },
  { name: "Redact", label: "Redact document", value: true },
  { name: "Manifest", label: "Generate manifest", value: true },
  { name: "Record", label: "Endorse document", value: true },
  { name: "Abstract", label: "Analyze document", value: true },
];

const WORKFLOW_SETTING_NAMES = new Set(["Review", "Redact", "Manifest", "Record", "Abstract"] as WorkflowSettingName[]);
const WORKFLOW_MANDATORY_SETTINGS: ReadonlySet<string> = new Set(["Redact", "Manifest", "Record", "Abstract"]);

function parseBooleanValue(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

export function normalizeWorkflowSettings(value: unknown): WorkflowSettings {
  if (!Array.isArray(value)) {
    return structuredClone(DEFAULT_WORKFLOW_SETTINGS);
  }

  const valueByName = new Map<WorkflowSettingName, boolean>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const setting = item as WorkflowSetting;
    if (!WORKFLOW_SETTING_NAMES.has(setting.name)) continue;
    valueByName.set(setting.name, parseBooleanValue(setting.value, DEFAULT_WORKFLOW_SETTINGS.find((candidate) => candidate.name === setting.name)?.value ?? false));
  }

  return DEFAULT_WORKFLOW_SETTINGS.map((setting) => ({
    ...setting,
    value: valueByName.has(setting.name) ? valueByName.get(setting.name) ?? setting.value : setting.value,
  }));
}

export function workflowValue(settings: WorkflowSettings | null | undefined, name: WorkflowSettingName): boolean {
  const normalized = normalizeWorkflowSettings(settings);
  return normalized.find((entry) => entry.name === name)?.value ?? false;
}

export function createIndexingPayload(choiceValues: unknown): ChoiceValue[] {
  const normalized = new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues(choiceValues);
  const systemChoices = CHOICESTRUCTURE.choices
    .flatMap((choice) => choice.items ?? [])
    .filter((item) => item.system)
    .map((item) => ({ service: item.name, level: 0 }));
  const filtered = normalized.filter((entry) => (
    !WORKFLOW_MANDATORY_SETTINGS.has(entry.service) &&
    !systemChoices.some((choice) => choice.service === entry.service)
  ));
  return [
    ...filtered,
    ...systemChoices,
    { service: "Redact", level: 0 },
    { service: "Manifest", level: 0 },
    { service: "Record", level: 0 },
    { service: "Abstract", level: 0 },
  ];
}

export const CHOICESTRUCTURE: ChoiceStructure = {
  choices: [
    {
      name: "Recognition",
      label: "Recognition Scope",
      default: "5",
      dependency: "",
      options: [
        { level: "Level1", description: "First Page Only" },
        { level: "Level2", description: "First 2 and Last Pages" },
        { level: "Level3", description: "First 5 and Last 3 Pages" },
        { level: "Level4", description: "First 8 and Last 5 Pages" },
        { level: "Level5", description: "First 12 and Last 8 Pages" },
        { level: "Level6", description: "All Pages" },
      ],
    },
    {
      name: "Indexing",
      items: [
        { name: "ConfidentialIndexing", label: "Confidential Indexing", dependency: "", default: true },
        { name: "TransactionIndexing", label: "Transaction Indexing", dependency: "Recognition:1", default: true },
        { name: "EndorsementIndexing", label: "Endorsement Indexing", dependency: "Recognition:1", default: true },
        { name: "PartyClauseIndexing", label: "Party Indexing", dependency: "Recognition:1", default: true },
        { name: "RecitalIndexing", label: "Reference Indexing", dependency: "Recognition:1", default: true },
        { name: "ExhibitIndexing", label: "Property & Legal Indexing", dependency: "Recognition:1", default: true },
        { name: "MonetaryInfoIndexing", label: "Monetary Indexing", dependency: "Recognition:1", default: false },
        { name: "AcknowledgmentIndexing", label: "Acknowledgment Indexing", dependency: "Recognition:1", default: true },
        { name: "CourtIndexing", label: "Court Indexing", dependency: "Recognition:1", default: false },
        { name: "VitalIndexing", label: "Vital Indexing", dependency: "Recognition:1", default: false },
      ],
    },
    {
      name: "Enhancements",
      items: [
        { name: "LegalEnrichment", label: "Legal Description Enrichment", dependency: "ExhibitIndexing:1", default: true },
        { name: "PartyEnrichment", label: "Party Enrichment", dependency: "PartyClauseIndexing:1", default: true },
        { name: "ChainEnrichment", label: "Title Chain Enrichment", dependency: "RecitalIndexing:1", default: false, system: true },
        { name: "HistoryEnrichment", label: "Title History Enrichment", dependency: "RecitalIndexing:1, MonetaryInfoIndexing:1", default: false, system: true },
        { name: "FeeComputation", label: "Fiscal Computation", dependency: "", default: false, system: true },
      ],
    },
    {
      name: "Processing",
      items: [
        { name: "Validation", label: "Validation & Correction", dependency: "", default: true },
      ],
    },
  ],
};

export class ChoiceData {
  jsonStructure: ChoiceStructure | null;

  constructor(jsonStructure: ChoiceStructure | null) {
    this.jsonStructure = jsonStructure;
  }

  getNumericValue(val: unknown): number {
    if (typeof val === "number") return val;
    if (val == null) return 0;
    const value = String(val).trim();
    if (!value) return 0;
    if (value.toLowerCase() === "none") return 0;
    const match = value.match(/-?\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  #buildResult(projectFn: (choice: NonNullable<ChoiceStructure["choices"]>[number], result: ChoiceValue[]) => void): ChoiceValue[] {
    const result: ChoiceValue[] = [];
    if (!this.jsonStructure || !Array.isArray(this.jsonStructure.choices)) {
      return result;
    }

    this.jsonStructure.choices.forEach((choice) => {
      projectFn(choice, result);
    });

    return result;
  }

  generateDefaultJson(): ChoiceValue[] {
    return this.#buildResult((choice, result) => {
      if (choice.options) {
        const def = choice.default ?? "None";
        result.push({
          service: choice.name,
          level: this.getNumericValue(def),
        });
      } else if (choice.items) {
        choice.items.forEach((item) => {
          result.push({ service: item.name, level: item.default ? 1 : 0 });
        });
      } else {
        result.push({
          service: choice.name,
          level: choice.default ? 1 : 0,
        });
      }
    });
  }

  normalizeChoiceValues(choices: unknown): ChoiceValue[] {
    let parsed = choices;
    while (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
        break;
      }
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as { items?: unknown }).items)
    ) {
      parsed = (parsed as { items: unknown[] }).items;
    }

    const defaults = this.generateDefaultJson();
    const byService = new Map(defaults.map((choice) => [choice.service, choice.level]));

    if (Array.isArray(parsed)) {
      for (const choice of parsed) {
        if (!choice || typeof choice !== "object") continue;
        const service = (choice as { service?: unknown }).service;
        const level = (choice as { level?: unknown }).level;
        if (typeof service !== "string" || !service.trim()) continue;
        if (!byService.has(service)) continue;
        const numericLevel = typeof level === "number" ? level : this.getNumericValue(level);
        byService.set(service, Number.isFinite(numericLevel) ? numericLevel : 0);
      }
    }

    return Array.from(byService, ([service, level]) => ({ service, level }));
  }

  generateDefaultResult(): ChoiceResult {
    const choices = this.generateDefaultJson();
    const workflow = normalizeWorkflowSettings(null);
    return { choices, workflow };
  }
}

export function dataLevel(data: unknown, name: string): number {
  try {
    let parsed = parseChoices(data);
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    if (!Array.isArray(parsed)) {
      return 0;
    }
    const match = parsed.find((choice) => choice?.service === name);
    return match ? Number(match.level) : 0;
  } catch (error) {
    const candidate = error as { error?: unknown; details?: unknown; message?: unknown };
    const message =
      candidate?.error ||
      candidate?.details ||
      candidate?.message ||
      "An error occurred. Please try again.";
    console.error("Show choices error:", message);
    return 0;
  }
}

function parseChoices(choices: unknown): unknown {
  if (typeof choices !== "string") {
    return choices;
  }
  return JSON.parse(choices);
}

export class Choices {
  static getActualPages(choices: unknown, pages: number): number {
    let parsed = choices;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return 0;
      }
    }
    const pagesLevel = dataLevel(parsed, "Recognition");
    switch (pagesLevel) {
      case 1:
        return Math.min(pages, 1);
      case 2:
        return Math.min(pages, 3);
      case 3:
        return Math.min(pages, 8);
      case 4:
        return Math.min(pages, 13);
      case 5:
        return Math.min(pages, 20);
      default:
        return pages;
    }
  }
}
