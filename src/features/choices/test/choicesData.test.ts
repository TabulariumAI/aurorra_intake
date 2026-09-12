import { describe, expect, it } from "vitest";
import { ChoiceData, Choices, CHOICESTRUCTURE, createIndexingPayload } from "../service/choicesData";

describe("choicesData", () => {
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
