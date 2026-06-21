import { lazy, Suspense } from "react";
import { ConfButton, ProgressBar } from "aurorra-ui";
import { getSelectReviewHostStyle, selectPanelStyles } from "../style/select.styles";
import type { UseSelectPanelResult } from "../type/select.types";
import { SelectForm } from "./SelectForm";

const SelectViewer = lazy(async () => {
  const module = await import("./SelectViewer");
  return { default: module.SelectViewer };
});

type SelectPanelViewProps = {
  dropTarget: HTMLElement;
  select: UseSelectPanelResult;
};

export function SelectPanelView({ dropTarget, select }: SelectPanelViewProps) {
  return (
    <div style={selectPanelStyles.host}>
      {select.mode === "select" ? (
        <SelectForm
          dropTarget={dropTarget}
          status={select.uploadStatus}
          onFileSelected={(file) => {
            void select.actions.selectFile(file);
          }}
          onStatusReset={select.actions.resetStatus}
        />
      ) : null}
      <div
        data-select-review-host="true"
        style={getSelectReviewHostStyle(select.mode === "review")}
      >
        {select.progress.visible ? (
          <ProgressBar running continuous durationMs={select.progress.durationMs} showText={select.progress.showText} />
        ) : null}
        {select.viewer.visible && select.viewer.props ? (
          <Suspense fallback={null}>
            <SelectViewer {...select.viewer.props} />
          </Suspense>
        ) : null}
      </div>
      {select.mode === "review" ? (
        <section data-select-review-actions="true" style={selectPanelStyles.reviewPanel}>
          <div style={selectPanelStyles.actions}>
            <ConfButton
              id="uploadStartButton"
              data-upload-start="true"
              label="Start"
              variant="primary"
              disabled={select.review.startDisabled}
              onConfirm={select.actions.start}
              armedColor="#069494"
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
                if (error === undefined) {
                  select.actions.cancel();
                }
              }}
              onConfirm={select.actions.cancel}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
