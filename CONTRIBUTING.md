# Contributing

## Requirements

- Node.js 22
- npm
- A sibling `aurora_core` checkout

## Local checks

```sh
npm install
npm test
npm run typecheck
npm run lint:boundary
npm run build
```

## Guidelines

- Preserve the host-owned boundaries for authentication, API gateway configuration, framing, and rendering slots.
- Keep document selection, session creation, upload, provisioning, indexing, and progress behavior in their existing feature areas.
- Add or update tests for behavior changes.
- Do not commit generated build output, coverage, test results, package tarballs, credentials, or local environment files.
