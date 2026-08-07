import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AurorraIntake,
  CHOICESTRUCTURE,
  ChoiceData,
  Choices,
  createSessionDataWorkerClient,
  createSessionWorkerClient,
  createStoreAdapter,
  dataLevel,
  loadSessionData,
  loadSession,
} from "./public-api";

const packageRoot = resolve(__dirname, "..");

describe("public-api", () => {
  it("is the package entrypoint", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
      main: string;
      module: string;
      types: string;
      exports: {
        ".": {
          import: string;
          types: string;
        };
      };
    };

    expect(packageJson.main).toBe("./src/public-api.ts");
    expect(packageJson.module).toBe("./src/public-api.ts");
    expect(packageJson.types).toBe("./src/public-api.ts");
    expect(packageJson.exports["."].import).toBe("./src/public-api.ts");
    expect(packageJson.exports["."].types).toBe("./src/public-api.ts");
    expect(existsSync(resolve(__dirname, "index.tsx"))).toBe(false);
    expect(existsSync(resolve(__dirname, "index.test.tsx"))).toBe(false);
    expect(readFileSync(resolve(packageRoot, "vite.config.ts"), "utf8")).toContain('entry: "src/public-api.ts"');
  });

  it("exports the used intake surface", () => {
    expect(AurorraIntake).toBeTypeOf("function");
    expect(CHOICESTRUCTURE).toBeTypeOf("object");
    expect(ChoiceData).toBeTypeOf("function");
    expect(Choices).toBeTypeOf("function");
    expect(createSessionDataWorkerClient).toBeTypeOf("function");
    expect(createSessionWorkerClient).toBeTypeOf("function");
    expect(createStoreAdapter).toBeTypeOf("function");
    expect(dataLevel).toBeTypeOf("function");
    expect(loadSessionData).toBeTypeOf("function");
    expect(loadSession).toBeTypeOf("function");
  });
});
