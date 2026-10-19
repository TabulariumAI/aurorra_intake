import { expect, it } from "vitest";
import { jurisdictionCode } from "../service/jurisdictionCode";

it.each([
  ["California, San Bernardino County", "san_bernardino_ca"],
  ["Texas, Harris County", "harris_tx"],
  ["Louisiana, Orleans Parish", "orleans_parish_la"],
  ["Virginia, Richmond city", "richmond_city_va"],
  ["Alaska, Anchorage Municipality", "anchorage_municipality_ak"],
  ["Connecticut, Capitol Planning Region", "capitol_planning_region_ct"],
])("normalizes %s to %s", (name, expected) => expect(jurisdictionCode(name)).toBe(expected));

it.each([null, "", "Unknown, Harris County", "Texas, not a county", "California"]) ("rejects missing or invalid jurisdiction %s", name => {
  expect(() => jurisdictionCode(name)).toThrow();
});
