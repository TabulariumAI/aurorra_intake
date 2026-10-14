import { expect, it } from "vitest";
import { JURISDICTIONS } from "../config/jurisdictions";

it("contains all 50 states with sorted, distinct counties and county equivalents", () => {
  const states = Object.keys(JURISDICTIONS);
  expect(states).toHaveLength(50);
  expect(states).toEqual([...states].sort());
  for (const counties of Object.values(JURISDICTIONS)) {
    expect(counties.length).toBeGreaterThan(0);
    expect(new Set(counties).size).toBe(counties.length);
    expect(counties).toEqual([...counties].sort());
    expect(counties.every((county) => county.trim() === county && !county.includes(", "))).toBe(true);
  }
  expect(JURISDICTIONS.Texas).toHaveLength(254);
  expect(JURISDICTIONS.California).toHaveLength(58);
  expect(JURISDICTIONS.Louisiana).toHaveLength(64);
  expect(JURISDICTIONS.Connecticut).toHaveLength(9);
  expect(JURISDICTIONS.Virginia).toContain("Richmond city");
});
