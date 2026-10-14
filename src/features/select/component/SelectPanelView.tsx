import { lazy, Suspense, useState } from "react";
import { ConfButton } from "aurora-core";
import { selectPanelStyles } from "../style/select.styles";
import type { IntakeCalloutRenderer, IntakeItemRenderer } from "../../intake/type/intake.types";
import type { UseSelectPanelResult } from "../type/select.types";
import { SelectForm } from "./SelectForm";

const SelectViewer = lazy(async () => {
  const module = await import("./SelectViewer");
  return { default: module.SelectViewer };
});

type SelectPanelViewProps = {
  active: boolean;
  maxFileSizeBytes: number;
  dropTarget: HTMLElement;
  helper: string;
  renderPreview: IntakeItemRenderer;
  renderSelect: IntakeItemRenderer;
  renderTolerance: IntakeCalloutRenderer;
  select: UseSelectPanelResult;
};

export function SelectPanelView({ active, maxFileSizeBytes, dropTarget, helper, renderPreview, renderSelect, renderTolerance, select }: SelectPanelViewProps) {
  const [selectAnchor, setSelectAnchor] = useState<HTMLButtonElement | null>(null);
  const selectContent = select.mode === "select" ? (
    <SelectForm
      selectRef={setSelectAnchor}
      maxFileSizeBytes={maxFileSizeBytes}
      dropTarget={dropTarget}
      status={select.uploadStatus}
      onFileSelected={(file) => {
        void select.actions.selectFile(file);
      }}
      onStatusReset={select.actions.resetStatus}
    />
  ) : null;
  const previewContent = select.mode === "review" ? (
    <>
      <div data-select-review-host="true" style={selectPanelStyles.reviewHost}>
        {select.viewer.visible && select.viewer.props ? (
          <Suspense fallback={null}>
            <SelectViewer {...select.viewer.props} />
          </Suspense>
        ) : null}
      </div>
      <section data-select-review-actions="true" style={selectPanelStyles.reviewPanel}>
        <div style={selectPanelStyles.actions}>
          <ConfButton
            id="uploadStartButton"
            data-upload-start="true"
            label="Start"
            variant="primary"
            disabled={select.review.startDisabled}
            onConfirm={select.actions.start}
          />
          <ConfButton
            id="settingsButton"
            data-select-settings="true"
            label="Settings"
            variant="secondary"
            requireConfirmation={false}
            onConfirm={select.actions.showSettings}
          />
          <ConfButton
            id="uploadCancelButton"
            data-upload-cancel="true"
            label="Cancel"
            variant="secondary"
            disabled={select.review.cancelDisabled}
            validate={() => select.actions.refreshCancelConfirm()}
            onValidationError={(error) => {
              if (error === undefined) select.actions.cancel();
            }}
            onConfirm={select.actions.cancel}
          />
        </div>
      </section>
    </>
  ) : null;

  return (
    <div style={selectPanelStyles.host}>
      {active && selectAnchor && select.sizeFailure ? renderTolerance({
        anchor: selectAnchor,
        onClose: select.actions.cancel,
        children: (
          <section style={selectPanelStyles.sizePrompt}>
            <p style={selectPanelStyles.sizeMessage}><strong>{select.sizeFailure.sourceName}</strong></p>
            <p style={selectPanelStyles.sizeMessage}>Page {select.sizeFailure.pageNumber}: {select.sizeFailure.width} × {select.sizeFailure.height} px</p>
            <p style={selectPanelStyles.sizeMessage}>
              This page exceeds the configured size tolerance of {Number((select.sizeFailure.tolerance * 100).toFixed(2))}%.
              Processing requires a higher tolerance of {Number((select.sizeFailure.requiredTolerance * 100).toFixed(2))}%.
              This change applies only to this Intake.
            </p>
            <div style={selectPanelStyles.actions}>
              <ConfButton label="Cancel" variant="secondary" requireConfirmation={false} onConfirm={select.actions.cancel} />
              <ConfButton label="Process anyway" variant="primary" requireConfirmation={false} onConfirm={select.actions.acceptSize} />
            </div>
          </section>
        ),
      }) : null}
      {select.mode === "review"
        ? renderPreview({ active, children: previewContent, helper })
        : renderSelect({ active, children: selectContent, helper })}
    </div>
  );
}
