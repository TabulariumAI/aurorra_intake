import { describe, expect, it } from "vitest";
import { ChoiceData, Choices, CHOICESTRUCTURE, createIndexingPayload } from "../service/choicesData";

describe("choicesData", () => {
  it.each([
    [1, { first: 1, last: 0 }],
    [2, { first: 2, last: 1 }],
    [3, { first: 5, last: 3 }],
    [4, { first: 8, last: 5 }],
    [5, { first: 12, last: 8 }],
    [6, { all: true }],
  ])("returns numeric page scope for level %s", (level, scope) => {
    expect(Choices.getPageScope([{ service: "Recognition", level }])).toEqual(scope);
  });

  it("resolves stored choices inside Intake and returns no raw text to preview", () => {
    expect(Choices.getPageScope(JSON.stringify([{ service: "Recognition", level: "5" }]))).toEqual({ first: 12, last: 8 });
    expect(Choices.getPageScope(null)).toBeNull();
    expect(Choices.getPageScope([{ service: "Recognition", level: 7 }])).toBeNull();
    expect(Choices.getPageScope([{ service: "Recognition", level: 1.5 }])).toBeNull();
  });

  it("preserves indexing counts for unavailable and malformed stored choices", () => {
    expect(Choices.getActualPages([{ service: "Recognition", level: 0 }], 27)).toBe(27);
    expect(Choices.getActualPages("{bad json", 27)).toBe(0);
  });

  it("uses the configured level identity when options are reordered or relabeled", () => {
    const group = CHOICESTRUCTURE.choices.find(choice => choice.name === "Recognition")!;
    const options = group.options;
    try {
      group.options = [...options!].reverse().map(option => ({ ...option, description: "Changed label" }));
      expect(Choices.getPageScope([{ service: "Recognition", level: 5 }])).toEqual({ first: 12, last: 8 });
      expect(Choices.getActualPages([{ service: "Recognition", level: 5 }], 27)).toBe(20);
    } finally {
      group.options = options;
    }
  });

  it("generates default choices for every configured visible service", () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson();

    expect(choices).toContainEqual({ service: "Recognition", level: 5 });
    expect(choices).toContainEqual({ service: "ConfidentialIndexing", level: 1 });
    expect(choices).toContainEqual({ service: "MonetaryInfoIndexing", level: 0 });
    expect(choices).not.toContainEqual({ service: "Redact", level: 0 });
    expect(choices).not.toContainEqual({ service: "Manifest", level: 0 });
    expect(choices).not.toContainEqual({ service: "Record", level: 0 });
    expect(choices).not.toContainEqual({ service: "Abstract", level: 0 });
  });

  it("normalizes strings, wrapped items, and malformed choice values onto defaults", () => {
    const data = new ChoiceData(CHOICESTRUCTURE);

    expect(data.normalizeChoiceValues(JSON.stringify({
      items: [
        { service: "Recognition", level: "Level3" },
        { service: "Redact", level: "yes" },
      ],
    }))).toContainEqual({ service: "Recognition", level: 3 });
    expect(data.normalizeChoiceValues([{ service: "Redact", level: 1 }])).toHaveLength(17);
    expect(data.normalizeChoiceValues("{bad json")).toContainEqual({ service: "Recognition", level: 5 });
  });

  it("forces required action services in indexing payload at level 0", () => {
    const payload = createIndexingPayload([{ service: "Recognition", level: 1 }]);

    expect(payload).toContainEqual({ service: "Redact", level: 0 });
    expect(payload).toContainEqual({ service: "Manifest", level: 0 });
    expect(payload).toContainEqual({ service: "Record", level: 0 });
    expect(payload).toContainEqual({ service: "Abstract", level: 0 });
    expect(payload).not.toContainEqual({ service: "Record", level: 1 });
  });

  it("does not change mandatory actions when backend values request different levels", () => {
    const payload = createIndexingPayload([
      { service: "Recognition", level: 1 },
      { service: "Redact", level: 0 },
      { service: "Manifest", level: 1 },
      { service: "Record", level: 1 },
      { service: "Abstract", level: 1 },
    ]);

    expect(payload.filter((choice) => choice.service === "Redact")).toHaveLength(1);
    expect(payload.filter((choice) => choice.service === "Manifest")).toHaveLength(1);
    expect(payload.filter((choice) => choice.service === "Record")).toHaveLength(1);
    expect(payload.filter((choice) => choice.service === "Abstract")).toHaveLength(1);
    expect(payload).toContainEqual({ service: "Redact", level: 0 });
    expect(payload).toContainEqual({ service: "Manifest", level: 0 });
    expect(payload).toContainEqual({ service: "Record", level: 0 });
    expect(payload).toContainEqual({ service: "Abstract", level: 0 });
  });

  it("forces hidden system choices to level 0 in the indexing payload", () => {
    const payload = createIndexingPayload([
      { service: "ChainEnrichment", level: 1 },
      { service: "HistoryEnrichment", level: 1 },
      { service: "FeeComputation", level: 1 },
    ]);

    expect(payload.filter((choice) => choice.service === "ChainEnrichment")).toEqual([
      { service: "ChainEnrichment", level: 0 },
    ]);
    expect(payload.filter((choice) => choice.service === "HistoryEnrichment")).toEqual([
      { service: "HistoryEnrichment", level: 0 },
    ]);
    expect(payload.filter((choice) => choice.service === "FeeComputation")).toEqual([
      { service: "FeeComputation", level: 0 },
    ]);
  });

  it.each([
    [1, 100, 1],
    [2, 100, 3],
    [3, 100, 8],
    [4, 100, 13],
    [5, 100, 20],
    [6, 100, 100],
    [2, 2, 2],
    [3, 2, 2],
    [4, 2, 2],
    [5, 2, 2],
  ])("limits level %i to %i page(s) for a %i-page document", (level, pages, expected) => {
    expect(Choices.getActualPages([{ service: "Recognition", level }], pages)).toBe(expected);
  });
});
