import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); });

it("hydrates only Intake-owned values from persisted storage", async () => {
  vi.resetModules();
  localStorage.setItem("aurorra-intake.local-state", JSON.stringify({ state: { indexChoices: [{ service: "Recognition", level: 4 }], jurisdiction: "Texas, Harris County", workflow: [{ name: "Iq", value: false }], settingsOpen: true } }));
  const { storeApi } = await import("../state/store");
  expect(storeApi.getState()).not.toHaveProperty("indexChoices");
  expect(storeApi.getState()).not.toHaveProperty("jurisdiction");
  expect(storeApi.getState()).not.toHaveProperty("workflow");
  expect(storeApi.getState()).not.toHaveProperty("settingsOpen");
});
