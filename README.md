# Aurorra Intake

Aurorra Intake is a React workflow for PDF and TIFF document selection, upload, session provisioning, and indexing in the Tabularium AI platform.

It is a host-integrated package. The host provides authentication, the API gateway URL, presentation slots, and lifecycle callbacks. Aurora service implementations and credentials are not included.

## Requirements

- Node.js 22
- npm
- A sibling `aurora_core` checkout, which provides the local `aurora-core` dependency used during development

## Install

```sh
npm install
```

## Use

The package exports `AurorraIntake`, its props type, session-loading helpers and read-only session state with domain actions.

```tsx
import { AurorraIntake } from "aurorra-intake";

<AurorraIntake
  config={{ review: false, iq: true, document: true }}
  authToken={authToken}
  apiGatewayUrl={apiGatewayUrl}
  intervalMs={3500}
  intervalPageMs={500}
  pageSize={appConfig.pageSize}
  tiffPixelFormat={appConfig.tiffPixelFormat}
  maxFileSizeBytes={appConfig.maxFileSizeBytes}
  onIndexed={({ session, document, etag }) => console.log(session, document, etag)}
  onLoaderChange={() => {}}
  onReadyChange={() => {}}
  renderPreview={({ children }) => children}
  renderProgress={({ children }) => children}
  renderSelect={({ children }) => children}
  renderTolerance={renderIntakeCallout}
/>
```

`intervalPageMs` controls each page update during refining, recognizing, identifying, and indexing. `intervalMs` controls enrichment, quality analysis, and retrieval checks. The host supplies 500 ms. Each enrichment and quality step retains a 7.5-second waiting budget; the eleven retrieval steps retain 82.5 seconds, independently of the polling interval. Page totals use the existing recognition selection; backend status determines completion.

`tiffPixelFormat` sets TIFF export to `bw1` (bitonal), `gray8` (grayscale), or `rgb24` (RGB). Intake applies it before opening or restoring the Lens session and preserves saved resolution and compression settings.

`renderTolerance` renders the host callout anchored to the Select document button. Its content shows the rejected page and explicit Process anyway / Cancel actions. Lens calculates the minimum tolerance using the configured formats; confirmation retries the same document with that tolerance only for the current selection. Cancel, clear, and a new Intake remove the override.

The host is responsible for supplying valid credentials and a gateway that implements the required session, provisioning, indexing, IQ, and image-package endpoints.

`onCreated(session)` runs after the backend allocates the session ID and before
upload starts. Intake awaits this callback so the host can persist the session
and its queued batch membership. After indexing completes, Intake conditionally
shows “Generating IQ report” and awaits generation and download through
`GET /v1/iq/{session}/data`, then “Generating the image package” through
`POST /v1/image/{session}/generate` with `{}`. Both first requests omit the ETag;
`user_svc` owns generation and waiting. Intake calls `onIndexed` and opens
metadata after selected stages complete. Its workers do not depend on
`aurorra-index` or a host generation callback. Stage failures keep progress open
without emitting completion; indexing timeout skips both stages.

`document_web/shell/settings` owns the Settings dialog and persisted config.
`wf_settings` contains host-owned workflow config, choices, and jurisdiction.
Intake receives execution flags, choices, jurisdiction, and recognition page scope through `config`;
it does not persist config or render a Settings button or panel. Sidebar Settings
opens the shell dialog before and after processing. The two post-index options
are Open IQ report after indexing and Load document after indexing, both true by
default. The four existing capability config controls remain hidden and retain
their stored values.

Completed indexing status includes the metadata ETag. `onIndexed` forwards it
with the indexed session; the host delivers the event to Index's `selectSession`
callback before opening panels. Metadata and IQ can load concurrently using that
version. An unchecked IQ config skips generation and automatic opening; manual
IQ opening remains available.
A failed `onCreated` prevents upload and preserves the allocated ID.

`onError(error)` offers session-creation failures to the host
with their original status, code, and details. Return `true` when host recovery
handles the failure; Intake then suppresses its local error presentation. Return
`false` to retain the progress error. Session-loading failures use
`onFailure(error)` with the original error object; `onAlert(message)` retains its
text notification. The host owns sign-in recovery.

## Development

```sh
npm install
npm test
npm run typecheck
npm run lint:boundary
npm run build
```

## Public Repository Notes

Do not commit credentials, authorization headers, SAS tokens, generated build output, test results, coverage, or local environment files. The repository contains source, tests, documentation, and package metadata only.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Settings choices and jurisdiction are host-owned config inputs. Intake consumes them without storage. Backend session choices belong to Index.
