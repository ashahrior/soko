# Architecture Overview

## High-Level Design

Knots is a Manifest V3 browser extension with four execution contexts:

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│                                                         │
│  ┌──────────────┐  messages   ┌───────────────────────┐ │
│  │  Popup UI    │───────────▶│  Background Service    │ │
│  │  (popup/)    │◀───────────│  Worker (background/)  │ │
│  └──────────────┘             │                       │ │
│                               │  ┌─── auth.ts         │ │
│  ┌──────────────┐             │  ├─── sheets-api.ts   │ │
│  │  Options UI  │─── msgs ──▶│  ├─── spreadsheet-mgr │ │
│  │  (options/)  │◀───────────│  ├─── cache-manager   │ │
│  └──────────────┘             │  ├─── categorizer     │ │
│                               │  └─── context-menu    │ │
│  ┌──────────────┐             │                       │ │
│  │ Content Script│◀── msgs ──│                       │ │
│  │  (toast.ts)  │            └───────────────────────┘ │
│  └──────────────┘                       │               │
│                                         ▼               │
│                              ┌─────────────────────┐    │
│                              │  chrome.storage.local│    │
│                              └─────────────────────┘    │
│                                         │               │
│                                         ▼               │
│                              ┌─────────────────────┐    │
│                              │  Google Sheets API   │    │
│                              │  Google Drive API    │    │
│                              └─────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Execution Contexts

### 1. Background Service Worker (`src/background/`)

The *only* context with full API access. Runs as an event-driven service worker (no persistent background page in MV3). All Google API calls, auth, caching, and business logic live here.

**Entry point:** `index.ts` — wires event listeners and routes messages.

**Modules:**

| Module | Responsibility |
|---|---|
| `auth.ts` | OAuth 2.0 login/logout, token refresh, `authenticatedFetch()` wrapper |
| `sheets-api.ts` | Thin typed wrappers over Sheets & Drive REST endpoints |
| `spreadsheet-manager.ts` | Spreadsheet initialization, sheet creation, header/validation setup |
| `cache-manager.ts` | In-memory `Set<string>` URL cache with `chrome.storage.local` persistence |
| `categorizer.ts` | Pure function mapping domain → content type (Video, Article, Code, etc.) |
| `domain-categories.ts` | Domain → category lookup table (imported by `categorizer.ts`) |
| `context-menu.ts` | Right-click "Knots: Save Note" registration and handler |

### 2. Popup (`src/popup/`)

Minimal UI shown when clicking the toolbar icon. Communicates with the background via `browser.runtime.sendMessage()`. Never calls Google APIs directly.

**States:** Logged-out (sign-in button) → Logged-in (save button or saved-page actions, spreadsheet link, sync, settings panel, logout).

When viewing a previously saved page, the popup shows status-aware action buttons instead of the save button:
- **"Viewing"** — marks the page as "In progress" in the spreadsheet
- **"Done"** — marks the page as "Done"
- If the page is already "Done", a static badge is shown

The popup also includes an inline **Settings** panel (sheet name selection with datalist, smart categorization toggle, cache clear) and a **Sync** button to refresh the URL cache from the spreadsheet.

### 3. Options Page (`src/options/`)

Settings page for sheet name, categorization toggle, and cache clearing. Also communicates via messages to the background.

### 4. Content Script (`src/content/toast.ts`)

Injected into all pages. Sole purpose: display toast notifications when the background sends a `showToast` message. Minimal footprint — no network access, no storage access.

## Module Dependency Graph

```
index.ts
  ├── auth.ts
  │     └── (chrome.identity / browser.identity)
  ├── sheets-api.ts
  │     └── auth.ts (authenticatedFetch)
  ├── spreadsheet-manager.ts
  │     └── sheets-api.ts
  ├── cache-manager.ts
  │     ├── sheets-api.ts (readColumn for sync)
  │     └── spreadsheet-manager.ts (getSheetName)
  ├── categorizer.ts (pure, no deps)
  │     └── domain-categories.ts (data)
  └── context-menu.ts
        └── (browser.contextMenus)
```

## Design Principles

1. **Background is the single source of truth** — Popup and options pages are stateless views that send messages and display responses.
2. **No heavy client libraries** — All Google API interaction is via direct `fetch()` calls wrapped in `authenticatedFetch()`. This keeps the service worker bundle small (~19 KB).
3. **Cross-browser from day one** — `webextension-polyfill` normalizes APIs. Auth has explicit Chrome vs. Firefox branches.
4. **Cache-first duplicate check** — The URL cache provides O(1) lookups without any network round-trip.
5. **Fail gracefully** — Content script injection failures, API errors, and expired tokens are all caught with user-facing feedback.
