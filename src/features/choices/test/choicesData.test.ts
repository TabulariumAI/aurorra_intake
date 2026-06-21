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

  it("caps actual pages according to recognition level", () => {
    expect(Choices.getActualPages([{ service: "Recognition", level: 3 }], 20)).toBe(8);
    expect(Choices.getActualPages([{ service: "Recognition", level: 4 }], 20)).toBe(13);
    expect(Choices.getActualPages([{ service: "Recognition", level: 5 }], 20)).toBe(18);
    expect(Choices.getActualPages([{ service: "Recognition", level: 6 }], 20)).toBe(20);
  });
});
