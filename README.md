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

The package exports `AurorraIntake`, its props type, session-loading helpers, workflow settings, and the intake store API.

```tsx
import { AurorraIntake } from "aurorra-intake";

<AurorraIntake
  authToken={authToken}
  apiGatewayUrl={apiGatewayUrl}
  intervalMs={3500}
  intervalPageMs={500}
  pageSize={appConfig.pageSize}
  tiffPixelFormat={appConfig.tiffPixelFormat}
  maxFileSizeBytes={appConfig.maxFileSizeBytes}
  onIndexed={({ session, document }) => console.log(session, document)}
  onLoaderChange={() => {}}
  onReadyChange={() => {}}
  renderChoices={({ children }) => children}
  renderPreview={({ children }) => children}
  renderProgress={({ children }) => children}
  renderSelect={({ children }) => children}
  renderTolerance={renderIntakeCallout}
/>
```

`intervalPageMs` controls each page update during refining, recognizing, identifying, and indexing. `intervalMs` controls enrichment, quality analysis, and retrieval checks. The host supplies 500 ms. Each enrichment and quality step retains a 7.5-second waiting budget; the eleven retrieval steps retain 82.5 seconds, independently of the polling interval. Page totals use the existing recognition selection; backend status determines completion.

`tiffPixelFormat` sets TIFF export to `bw1` (bitonal), `gray8` (grayscale), or `rgb24` (RGB). Intake applies it before opening or restoring the Lens session and preserves saved resolution and compression settings.

`renderTolerance` renders the host callout anchored to the Select document button. Its content shows the rejected page and explicit Process anyway / Cancel actions. Lens calculates the minimum tolerance using the configured formats; confirmation retries the same document with that tolerance only for the current selection. Cancel, clear, and a new Intake remove the override.

The host is responsible for supplying valid credentials and a gateway that implements the required session, workflow-settings, provisioning, and indexing endpoints.

`onCreated(session)` runs after the backend allocates the session ID and before
upload starts. Intake awaits this callback so the host can persist the session
and its queued batch membership. `onIndexed` remains the indexing completion
callback; a failed `onCreated` prevents upload and preserves the allocated ID.

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
