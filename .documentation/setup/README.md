# Developer Setup & Onboarding

## Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **npm** (ships with Node.js)
- A **Google Cloud** project with:
  - Google Sheets API enabled
  - Google Drive API enabled
  - OAuth 2.0 Client ID credentials

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> && cd knots

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# 4. Build for Chrome
npm run build:chrome

# 5. Load in Chrome
#    chrome://extensions → Enable Developer mode → Load unpacked → select dist-chrome/
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |

This is injected at build time via Vite's `import.meta.env`.

## Google Cloud Setup

### Creating OAuth Credentials

**For Chrome:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Application type: **Chrome Extension**
3. Enter your extension's ID (visible at `chrome://extensions` after loading unpacked)

**For Firefox:**
1. Same console → Create OAuth 2.0 Client ID → Application type: **Web Application**
2. Add your extension's redirect URL as an Authorized Redirect URI
3. Get the redirect URL by calling `browser.identity.getRedirectURL()` from the extension console

### Enabling APIs

In the Google Cloud Console → APIs & Services → Library:
- Enable **Google Sheets API**
- Enable **Google Drive API**

## NPM Scripts

| Command | Description |
|---|---|
| `npm run dev:chrome` | Build Chrome extension in watch mode |
| `npm run dev:firefox` | Build Firefox extension in watch mode |
| `npm run build:chrome` | Production build → `dist-chrome/` |
| `npm run build:firefox` | Production build → `dist-firefox/` |
| `npm run build` | Build both targets |
| `npm test` | Run all tests (single run) |
| `npm run test:watch` | Run tests in watch mode |
| `npx tsc --noEmit` | Type check without emitting |

## Project Structure

```
src/
├── background/           # Service worker (auth, API, cache, save logic)
│   ├── index.ts          # Entry point — event listeners, message router
│   ├── auth.ts           # OAuth login/logout, token management
│   ├── sheets-api.ts     # Google Sheets + Drive REST wrappers
│   ├── spreadsheet-manager.ts  # Spreadsheet init, sheet creation
│   ├── cache-manager.ts  # URL cache (in-memory Set + storage)
│   ├── categorizer.ts    # URL → content type mapping
│   ├── domain-categories.ts  # Domain → category lookup table
│   └── context-menu.ts   # Right-click menu registration
├── content/
│   └── toast.ts          # Toast notifications (injected into pages)
├── popup/                # Toolbar popup UI (login, save, status tracking, settings, logout)
├── options/              # Settings page (sheet name, toggles)
├── shared/
│   └── types.ts          # Shared TypeScript types
├── icons/                # Source icon PNGs
├── manifest.json         # MV3 manifest
└── env.d.ts              # Vite env type declarations

tests/                    # Vitest test suite
├── __mocks__/
│   └── webextension-polyfill.ts
├── categorizer.test.ts
├── cache-manager.test.ts
├── spreadsheet-manager.test.ts
├── context-menu.test.ts
└── types.test.ts
```

## Build System

Knots uses **Vite 8** with `vite-plugin-web-extension` for building. The `TARGET` env var selects the browser:

```bash
TARGET=chrome vite build    # → dist-chrome/
TARGET=firefox vite build   # → dist-firefox/
```

### Manifest Path Convention

All paths in `src/manifest.json` are prefixed with `src/` because `vite-plugin-web-extension` resolves paths relative to the **project root** (Vite's rootDir), not the manifest file's directory. This is an important detail if you add new scripts or pages.

### Icons

Icons in `public/src/icons/` are copied as static assets to the build output. The `scripts/generate-icons.mjs` script creates placeholder PNGs for development.

## Loading the Extension

### Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist-chrome/` folder
5. Pin the Knots icon in the toolbar

### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select any file inside `dist-firefox/` (e.g. `manifest.json`)

> Firefox temporary add-ons are removed on browser close. For persistence, package as `.xpi` and sign via addons.mozilla.org.

## Recommended Reading Order

If you're new to the codebase, read the documentation in this order:

1. [Architecture](../architecture/README.md) — system overview and module map
2. [Data Flow](../data-flow/README.md) — end-to-end traces of every action
3. [Authentication](../authentication/README.md) — OAuth flow and token lifecycle
4. [Caching](../caching/README.md) — URL cache design and consistency model
5. [API Layer](../api/README.md) — Google Sheets/Drive wrapper reference
6. [Testing](../testing/README.md) — test strategy and mock architecture
