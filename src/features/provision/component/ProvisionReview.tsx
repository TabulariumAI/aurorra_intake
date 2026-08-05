import { CSSProperties } from "react";
import { ConfButton } from "aurorra-ui";
import type { ProvisionReviewOptions } from "../type/provision.types";

const hostStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: "0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

const panelStyle: CSSProperties = {
  width: "min(52rem, 100%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1.15rem",
  textAlign: "center",
  color: "var(--text-color-light)",
  padding: "1.7rem",
  boxSizing: "border-box",
};

const contentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  lineHeight: 1.55,
  maxWidth: "42rem",
};

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.96rem",
  opacity: 0.82,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "0.25rem",
};

function DescriptionText({ description, accepted }: { description: string; accepted: boolean }) {
  const reviewText = "Your document has successfully passed the initial review.";
  const start = description.indexOf(reviewText);

  if (!accepted || start === -1) {
    return <>{description}</>;
  }

  return (
    <>
      {description.slice(0, start)}
      Your document has <strong>successfully passed</strong> the initial review.
      {description.slice(start + reviewText.length)}
    </>
  );
}

export function ProvisionReview({
  description,
  accepted,
  document,
  onContinue,
  onCancel,
}: ProvisionReviewOptions) {
  return (
    <section data-provision-review="true" style={hostStyle}>
      <div style={panelStyle}>
        <div style={contentStyle}>
          <h1>Document screening completed.</h1><hr />
          <p data-provision-description="true" style={textStyle}>
            <DescriptionText description={description} accepted={accepted} />
          </p>
          <p style={textStyle}>
            {accepted
              ? "A comprehensive analysis of this document will now be performed to classify and extract all required information. Please feel free to adjust the rolebook as needed."
              : "We can still process it; if no matching data is found, the result will simply be empty."}
          </p>
        </div>
        <div style={actionsStyle}>
          <ConfButton
            data-provision-continue="true"
            label="Continue"
            variant="primary"
            requireConfirmation={false}
            onConfirm={() => onContinue(document)}
          />
          <ConfButton
            data-provision-cancel="true"
            label="Cancel and Restart"
            variant="secondary"
            requireConfirmation={false}
            onConfirm={onCancel}
          />
        </div>
      </div>
    </section>
  );
}
