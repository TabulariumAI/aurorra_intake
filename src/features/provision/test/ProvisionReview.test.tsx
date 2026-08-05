import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProvisionReview } from "../component/ProvisionReview";

describe("ProvisionReview", () => {
  it("renders the screening summary without a package frame", () => {
    const { container } = render(
      <ProvisionReview
        accepted
        description="Your document has successfully passed the initial review."
        document={new File(["document"], "document.pdf", { type: "application/pdf" })}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    const panel = container.querySelector("[data-provision-review='true'] > div");
    expect((panel as HTMLElement).style.border).toBe("");
  });
});
