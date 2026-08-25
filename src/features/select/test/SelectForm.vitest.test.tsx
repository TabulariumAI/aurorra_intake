import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectForm } from "../component/SelectForm";

describe("SelectForm", () => {
  it("fills the available panel height above the safety section", () => {
    const { container } = render(
      <SelectForm
        dropTarget={document.createElement("section")}
        status={{ kind: "idle" }}
        onFileSelected={vi.fn()}
        onStatusReset={vi.fn()}
      />,
    );

    const dropZone = container.querySelector<HTMLElement>("[data-upload-drop-zone='true']");

    expect(dropZone?.style.flex).toBe("1 1 auto");
  });
});
