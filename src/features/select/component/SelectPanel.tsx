import { useEffect, useRef } from "react";
import { useSelectPanel } from "../hook/useSelectPanel";
import type { SelectPanelProps, SelectService } from "../type/select.types";
import type { IntakeCalloutRenderer, IntakeItemRenderer } from "../../intake/type/intake.types";
import { SelectPanelView } from "./SelectPanelView";

type SelectPanelInternalProps = SelectPanelProps & {
  active: boolean;
  onLoaderChange(lines: readonly string[] | null): void;
  onReadyChange(ready: boolean): void;
  helper: string;
  renderPreview: IntakeItemRenderer;
  renderSelect: IntakeItemRenderer;
  renderTolerance: IntakeCalloutRenderer;
  service: SelectService;
};

export function SelectPanel({
  active,
  pageSize,
  tiffPixelFormat,
  maxFileSizeBytes,
  dropTarget,
  actions,
  onLoaderChange,
  onReadyChange,
  helper,
  renderPreview,
  renderSelect,
  renderTolerance,
  service,
  selectionResetVersion,
}: SelectPanelInternalProps) {
  const initializedRef = useRef(false);
  const select = useSelectPanel({ pageSize, tiffPixelFormat, maxFileSizeBytes, actions, service, selectionResetVersion });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    select.actions.initialize();
  }, [select.actions]);

  useEffect(() => {
    onLoaderChange(select.loading ? [] : null);
    onReadyChange(!select.loading);
  }, [onLoaderChange, onReadyChange, select.loading]);

  return (
    <SelectPanelView
      maxFileSizeBytes={maxFileSizeBytes}
      active={active}
      dropTarget={dropTarget}
      helper={helper}
      renderPreview={renderPreview}
      renderSelect={renderSelect}
      renderTolerance={renderTolerance}
      select={select}
    />
  );
}
