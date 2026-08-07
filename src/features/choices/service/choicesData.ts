import type { ChoiceResult, ChoiceStructure, ChoiceValue } from "../type/choices.types";

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
        { name: "Redact", label: "Redacted Document", dependency: "ConfidentialIndexing:1", default: false },
        { name: "Manifest", label: "Generate Manifest", dependency: "", default: true },
        { name: "Record", label: "Endorse the Document", dependency: "FeeComputation:1", default: false },
        { name: "Abstract", label: "Title Analysis", dependency: "ChainEnrichment:1, HistoryEnrichment:1", default: false },
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

  #buildWorkflowDefaults() {
    const workflow =
      this.jsonStructure &&
      typeof this.jsonStructure === "object" &&
      this.jsonStructure.workflow &&
      typeof this.jsonStructure.workflow === "object"
        ? this.jsonStructure.workflow
        : null;

    let alwaysReview = false;
    let autoRefine = false;

    if (workflow) {
      if (typeof workflow.alwaysReview === "boolean") {
        alwaysReview = workflow.alwaysReview;
      }
      if (typeof workflow.autoRefine === "boolean") {
        autoRefine = workflow.autoRefine;
      }
    }

    return { alwaysReview, autoRefine };
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
        const numericLevel = typeof level === "number" ? level : this.getNumericValue(level);
        byService.set(service, Number.isFinite(numericLevel) ? numericLevel : 0);
      }
    }

    return Array.from(byService, ([service, level]) => ({ service, level }));
  }

  generateDefaultResult(): ChoiceResult {
    const choices = this.generateDefaultJson();
    const workflow = this.#buildWorkflowDefaults();
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
  static getIdentifyingIndexes(choices: unknown, choiceStructure: ChoiceStructure): string[] | 0 {
    let parsed = choices;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return 0;
      }
    }
    if (!parsed || !Array.isArray(parsed)) return [];

    const indexing = choiceStructure.choices.find((choice) => choice.name === "Indexing");
    if (!indexing || !Array.isArray(indexing.items)) return [];
    let processes = [
      "Analyzing Page",
      "Identifying Indexes",
    ];

    const enhancements = choiceStructure.choices.find((choice) => choice.name === "Enhancements");
    if (enhancements && Array.isArray(enhancements.items)) {
      processes = processes.concat("Validating Indexes");
      processes = processes.concat("Enriching Indexes");
    }

    return processes;
  }

  static getIdEnh(choices: unknown, choiceStructure: ChoiceStructure): string[] {
    if (!choices || !Array.isArray(choices)) return [];
    const levels: Record<string, number> = {};
    for (const choice of choices) {
      if (
        choice &&
        typeof choice === "object" &&
        typeof (choice as ChoiceValue).service === "string" &&
        typeof (choice as ChoiceValue).level === "number"
      ) {
        levels[(choice as ChoiceValue).service] = (choice as ChoiceValue).level;
      }
    }
    const enhancements = choiceStructure.choices.find((choice) => choice.name === "Enhancements");
    if (!enhancements || !Array.isArray(enhancements.items)) return [];
    return enhancements.items
      .filter((item) => levels[item.name] > 1)
      .map((item) => `Identifying ${item.label.replace("Indexing", "Indexes")}`);
  }

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
    let actualPages = pages;
    if (actualPages > 3 && pagesLevel > 2) {
      switch (pagesLevel) {
        case 3:
          if (actualPages > 8) actualPages = 8;
          break;
        case 4:
          if (actualPages > 13) actualPages = 13;
          break;
        case 5:
          if (actualPages > 18) actualPages = 18;
          break;
      }
    }
    return actualPages;
  }

  static #normalizeBoolean(value: unknown, defaultValue = true): boolean {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "n") return false;
    return defaultValue;
  }

  static getdWorkflow(choices: unknown = null): boolean {
    try {
      const parsed = JSON.parse(String(choices));
      return this.#normalizeBoolean(parsed, true);
    } catch {
      return this.#normalizeBoolean(choices, true);
    }
  }
}
