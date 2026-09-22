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
  maxFileSizeBytes={appConfig.maxFileSizeBytes}
  onIndexed={({ session, document }) => console.log(session, document)}
  onLoaderChange={() => {}}
  onReadyChange={() => {}}
  renderChoices={({ children }) => children}
  renderPreview={({ children }) => children}
  renderProgress={({ children }) => children}
  renderSelect={({ children }) => children}
/>
```

The host is responsible for supplying valid credentials and a gateway that implements the required session, workflow-settings, provisioning, and indexing endpoints.

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
