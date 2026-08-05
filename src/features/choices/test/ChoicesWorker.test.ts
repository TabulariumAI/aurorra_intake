import { describe, expect, it } from "vitest";
import { ChoicesWorker } from "../worker/ChoicesWorker";

describe("ChoicesWorker", () => {
  it("builds the user gateway index choices route", () => {
    expect(new ChoicesWorker().buildUrl({
      type: "load",
      token: "token-1",
      session: "session/1",
      config: { apiBaseUrl: "https://user.example/" },
    })).toBe("https://user.example/v1/index/session%2F1/choices");
  });
});
