# Alt Text Generator Pro

Alt Text Generator Pro is two products on one backend:

- a complete Chrome extension for human users;
- a separately authenticated and metered MCP/API service for agents.

The public website is a landing, Chrome product/pricing, API/MCP, support, privacy, and terms surface. It is not a customer generator.

## Project Docs

- Confirmed product requirements: `docs/product-requirements.md`
- Web deployment and verification boundaries: `docs/web-deployment.md`

## Main workspaces

- Chrome UI: `ui`
- Extension runtime: `manifest.json`, `background.js`, `content.js`
- Public website: `apps/web`
- Shared backend and agent API/MCP: `server`
- Lossless client metadata helpers: `utils/metadata.js`

## Local verification

```sh
npm --prefix ui run build
npm --prefix apps/web run build
npm --prefix server test
npm --prefix server run build
node --experimental-default-type=module --test tests/metadata.test.js
./scripts/build-extension-package.sh
```

Loading the unpacked extension in Chrome requires the repository root (the folder containing `manifest.json`), not the `ui` source folder.
