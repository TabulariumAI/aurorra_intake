import { describe, expect, it } from "vitest";
import { ChoiceData, Choices, CHOICESTRUCTURE } from "../service/choicesData";

describe("choicesData", () => {
  it("generates default choices for every configured service", () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson();

    expect(choices).toContainEqual({ service: "Recognition", level: 5 });
    expect(choices).toContainEqual({ service: "ConfidentialIndexing", level: 1 });
    expect(choices).toContainEqual({ service: "MonetaryInfoIndexing", level: 0 });
    expect(choices).toContainEqual({ service: "Record", level: 0 });
  });

  it("normalizes strings, wrapped items, and malformed choice values onto defaults", () => {
    const data = new ChoiceData(CHOICESTRUCTURE);

    expect(data.normalizeChoiceValues(JSON.stringify({
      items: [
        { service: "Recognition", level: "Level3" },
        { service: "Record", level: "yes" },
      ],
    }))).toContainEqual({ service: "Recognition", level: 3 });
    expect(data.normalizeChoiceValues("{bad json")).toContainEqual({ service: "Recognition", level: 5 });
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
