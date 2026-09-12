import { lazy, Suspense } from "react";
import { ConfButton } from "aurora-core";
import { selectPanelStyles } from "../style/select.styles";
import type { IntakeItemRenderer } from "../../intake/type/intake.types";
import type { UseSelectPanelResult } from "../type/select.types";
import { SelectForm } from "./SelectForm";

const SelectViewer = lazy(async () => {
  const module = await import("./SelectViewer");
  return { default: module.SelectViewer };
});

type SelectPanelViewProps = {
  active: boolean;
  dropTarget: HTMLElement;
  helper: string;
  renderPreview: IntakeItemRenderer;
  renderSelect: IntakeItemRenderer;
  select: UseSelectPanelResult;
};

export function SelectPanelView({ active, dropTarget, helper, renderPreview, renderSelect, select }: SelectPanelViewProps) {
  const selectContent = select.mode === "select" ? (
    <SelectForm
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
      {select.mode === "review"
        ? renderPreview({ active, children: previewContent, helper })
        : renderSelect({ active, children: selectContent, helper })}
    </div>
  );
}
