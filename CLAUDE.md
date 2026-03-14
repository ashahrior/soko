# CLAUDE.md — Soko Browser Extension

## Project Overview

Soko is a browser extension (Chrome MV3 + Firefox MV3) that saves web resources to a dedicated Google Spreadsheet with one click. It auto-categorizes pages, prevents duplicates via a local URL cache, and provides a visual "peek" indicator for previously saved pages.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite 8 + `vite-plugin-web-extension` (dual Chrome/Firefox output)
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`
- **Browser APIs:** `webextension-polyfill` for cross-browser compatibility
- **Testing:** Vitest
- **APIs:** Google Sheets API v4, Google Drive API v3 (REST over fetch)

## Project Structure

```
src/
├── background/           # Service worker modules
│   ├── index.ts          # Entry — event listeners, save pipeline, message router
│   ├── auth.ts           # OAuth 2.0 (Chrome getAuthToken / Firefox launchWebAuthFlow)
│   ├── sheets-api.ts     # Thin typed wrapper over Sheets & Drive REST APIs
│   ├── spreadsheet-manager.ts  # Spreadsheet init, sheet creation, header/validation setup
│   ├── cache-manager.ts  # In-memory Set<string> URL cache with storage persistence
│   ├── categorizer.ts    # Domain → content type mapping (pure function)
│   └── context-menu.ts   # Right-click "Save Note" context menu registration
├── content/
│   └── toast.ts          # Content script — shows toast notifications on pages
├── popup/
│   ├── index.html        # Extension popup UI
│   ├── main.ts           # Popup logic (login/save/logout)
│   └── style.css         # Tailwind entry
├── options/
│   ├── index.html        # Settings page
│   ├── main.ts           # Options logic (sheet name, categorization toggle, cache clear)
│   └── style.css         # Tailwind entry
├── icons/                # Source icon PNGs (placeholder)
├── shared/
│   └── types.ts          # Shared type definitions (messages, storage schema, row shape)
├── manifest.json         # WebExtension manifest v3
└── env.d.ts              # Vite ImportMeta env types

tests/
├── __mocks__/
│   └── webextension-polyfill.ts  # Browser API mock with storage simulation
├── categorizer.test.ts
├── cache-manager.test.ts
├── spreadsheet-manager.test.ts
├── context-menu.test.ts
└── types.test.ts

public/src/icons/         # Icons copied to build output as static assets
scripts/
└── generate-icons.mjs    # Generates placeholder icon PNGs
```

## Commands

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev:chrome        # Build Chrome extension with HMR
npm run dev:firefox       # Build Firefox extension with HMR

# Production build
npm run build:chrome      # Output: dist-chrome/
npm run build:firefox     # Output: dist-firefox/
npm run build             # Both targets

# Run tests
npm test                  # Single run
npm run test:watch        # Watch mode

# Type check
npx tsc --noEmit
```

## Architecture Notes

### Authentication
- Chrome uses `chrome.identity.getAuthToken` (promise-based)
- Firefox uses `browser.identity.launchWebAuthFlow` (no getAuthToken support)
- Runtime detection via `isChrome()` in `auth.ts`
- Token + email stored in `chrome.storage.local`

### Data Flow (Save Pipeline)
1. User clicks extension icon or right-clicks "Soko: Save Note"
2. `handleSave()` in background checks URL cache for duplicates
3. If new: categorize URL → build row → `appendRow()` to Google Sheets → update cache → send toast
4. If duplicate: send "Already saved" toast

### URL Cache
- `Set<string>` in memory, serialized as `string[]` in `chrome.storage.local`
- Full sync from spreadsheet Column C on install and manual "Clear Cache"
- Instant O(1) duplicate lookups without API calls

### Manifest Path Convention
- All paths in `src/manifest.json` are prefixed with `src/` because `vite-plugin-web-extension` resolves relative to the project root (Vite rootDir), not the manifest file's directory

### Environment Variables
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID, injected at build time
- Copy `.env.example` to `.env` and fill in before building

## Testing

Tests use Vitest with a custom `webextension-polyfill` mock that simulates `browser.storage.local` with an in-memory store. The mock provides `__resetStorage()` and `__setStorage()` helpers for test setup.

Sheets API calls are mocked via `vi.mock()` in tests that depend on them.

## Key Design Decisions

- `vite-plugin-web-extension` over `@crxjs/vite-plugin` for first-class Firefox support
- No heavyweight client libraries (no `googleapis` npm package) — direct REST fetch calls to keep the service worker bundle small
- Tailwind v4 with `@tailwindcss/vite` plugin (no PostCSS config needed)
- `webextension-polyfill` for cross-browser `browser.*` API normalization

## User Guide

### Prerequisites

1. **Google Cloud Project** — Create a project at [console.cloud.google.com](https://console.cloud.google.com/)
2. **Enable APIs** — In your project, enable **Google Sheets API** and **Google Drive API**
3. **OAuth Credentials** — Create an OAuth 2.0 Client ID:
   - **Chrome:** Application type = "Chrome Extension", supply your extension ID
   - **Firefox:** Application type = "Web application", add your extension's redirect URL as an authorized redirect URI
4. **Copy your Client ID** into a `.env` file at the project root:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```

### Building the Extension

```bash
npm install
npm run build:chrome    # → dist-chrome/
npm run build:firefox   # → dist-firefox/
```

### Installing on Chrome

1. Open `chrome://extensions` in your browser
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `dist-chrome/` folder from your project
5. The Soko icon appears in your toolbar — pin it for easy access

### Installing on Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select any file inside the `dist-firefox/` folder (e.g. `manifest.json`)
4. The Soko icon appears in your toolbar

> **Note:** Temporary add-ons in Firefox are removed when the browser closes. For persistent installation, package as `.xpi` and sign via [addons.mozilla.org](https://addons.mozilla.org/).

### Using the Extension

#### Sign In
- Click the Soko icon in the toolbar to open the popup
- Click **Sign in with Google** and authorize with your Google account
- On first login, Soko automatically creates a spreadsheet named **"Soko"** in your Google Drive with a **"Default"** sheet

#### One-Click Save
- Navigate to any webpage and click the Soko icon
- Click **Save Current Page** — the page title, URL, category, and timestamp are written to your spreadsheet
- A toast notification confirms the save on the webpage

#### Right-Click Save with Notes
- Highlight any text on a page
- Right-click and select **Soko: Save Note**
- The page is saved with the selected text in the **Notes** column

#### Peek Indicator
- When you visit a page that's already saved, the Soko icon shows a green **✓** badge
- This lets you know at a glance which pages are in your spreadsheet

#### Settings (Options Page)
- Right-click the Soko icon → **Options** (or find it in `chrome://extensions`)
- **Default Sheet Name** — Change which sheet tab saves go to (a new sheet is created automatically if needed)
- **Smart Categorization** — Toggle automatic type detection (Video, Article, Code, etc.) on or off
- **Clear Local Cache** — Reset the local URL cache; use this if the badge indicator seems out of sync

#### Open Your Spreadsheet
- Click the Soko icon → **Open Soko Spreadsheet ↗** to jump directly to your Google Sheet

#### Logout
- Click the Soko icon → **Logout** to sign out and clear all local data
