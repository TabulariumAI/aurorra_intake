import type { ViewerState } from "@tabulariumai/aurora-lens";
import { ConfButton } from "aurora-core";
import { useSelectViewer } from "../hook/useSelectViewer";
import { selectViewerStyle, wrapperStyles } from "../style/select.styles";
import type { SelectViewerProps } from "../type/selectViewer.types";

type ViewerNavProps = {
  state: NonNullable<ViewerState>;
  onShowThumbnails: () => Promise<void> | void;
  onPreviousPage: () => Promise<void> | void;
  onNextPage: () => Promise<void> | void;
};

function ViewerNav({
  state,
  onShowThumbnails,
  onPreviousPage,
  onNextPage,
}: ViewerNavProps) {
  return (
    <div data-aurora-navigation="true" style={selectViewerStyle.nav}>
      <ConfButton
        title="All thumbnails"
        aria-label="All thumbnails"
        data-upload-show-thumbnails="true"
        disabled={!state.canShowThumbnails}
        label={<ViewerIcon name="thumbnails" />}
        size="icon"
        variant="secondary"
        requireConfirmation={false}
        onConfirm={() => {
          void onShowThumbnails();
        }}
      />
      <ConfButton
        title="Previous page"
        aria-label="Previous page"
        data-upload-previous-page="true"
        disabled={!state.canGoPrevious}
        label={<ViewerIcon name="prev" />}
        size="icon"
        variant="secondary"
        requireConfirmation={false}
        onConfirm={() => {
          void onPreviousPage();
        }}
      />
      <ConfButton
        title="Next page"
        aria-label="Next page"
        data-upload-next-page="true"
        disabled={!state.canGoNext}
        label={<ViewerIcon name="next" />}
        size="icon"
        variant="secondary"
        requireConfirmation={false}
        onConfirm={() => {
          void onNextPage();
        }}
      />
    </div>
  );
}

type ViewerIconName = "thumbnails" | "prev" | "next";

function ViewerIcon({ name }: { name: ViewerIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={selectViewerStyle.icon}>
      {name === "thumbnails" ? (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </>
      ) : name === "prev" ? (
        <path d="M15 6l-8 6 8 6" />
      ) : (
        <path d="M9 6l8 6-8 6" />
      )}
    </svg>
  );
}

export function SelectViewer({
  allowEdit = false,
  onAddError,
  onError,
  onStateChange,
  onStatusChange,
  onApiReady,
}: SelectViewerProps) {
  const {
    lensHostRef,
    nextPage,
    previousPage,
    showThumbnails,
    state,
  } = useSelectViewer({
    allowEdit,
    onAddError,
    onError,
    onStateChange,
    onStatusChange,
    onApiReady,
  });

  return (
    <div data-aurora-wrapper="true" style={wrapperStyles}>
      <div data-aurora-lens-host="true" style={selectViewerStyle.lens} ref={lensHostRef} />
      {state?.viewMode === "page" ? (
        <ViewerNav
          state={state}
          onShowThumbnails={showThumbnails}
          onPreviousPage={previousPage}
          onNextPage={nextPage}
        />
      ) : null}
    </div>
  );
}
