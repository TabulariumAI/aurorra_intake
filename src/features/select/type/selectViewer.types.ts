import type { AuroraLens, DecodeDocOptions, PageSizeConfig, ViewerState, ViewerStatus } from "@tabulariumai/aurora-lens";

export type SelectViewerOptions = {
  pageSize: PageSizeConfig;
  allowEdit?: boolean;
  onAddError?: (error: Error) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: ViewerState) => void;
  onStatusChange?: (status: ViewerStatus) => void;
};

export type SelectViewerProps = SelectViewerOptions & {
  onApiReady?: (api: ViewerApi | null) => void;
};

export type ViewerDecodeOptions = DecodeDocOptions;
export type ViewerApi = AuroraLens;
