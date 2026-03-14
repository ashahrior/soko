<p align="center">
  <img src="src/icons/icon-128.png" alt="Knots" width="96" height="96" />
</p>

<h1 align="center">Knots</h1>

<p align="center">
  <strong>Save, categorize, and track web resources directly into a Google Spreadsheet.</strong>
</p>

<p align="center">
  <img alt="Chrome MV3" src="https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white" />
  <img alt="Firefox MV3" src="https://img.shields.io/badge/Firefox-MV3-FF7139?logo=firefox&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-ISC-green" />
</p>

---

Knots is a browser extension that saves any webpage to a dedicated Google Spreadsheet with one click. It auto-categorizes pages, prevents duplicates via a local URL cache, and shows a badge indicator on previously saved pages.

## Features

- **One-Click Save** — Click the toolbar icon to save the current page (title, URL, category, timestamp)
- **Right-Click Save with Notes** — Highlight text, right-click → "Knots: Save Note" to save with annotations
- **Smart Categorization** — Automatically detects content type (Video, Article, Code, Q&A, Forum) based on the domain
- **Duplicate Detection** — Instant client-side URL cache prevents saving the same page twice
- **Peek Indicator** — Green ✓ badge on the toolbar icon when you visit an already-saved page
- **Status Tracking** — Each saved entry has a status column (Todo / In progress / Done) with dropdown validation
- **Cross-Browser** — Works on both Chrome and Firefox (Manifest V3)

## How It Works

```
Click "Save" → Check cache for duplicates → Categorize URL → Append row to Google Sheets → Update badge
```

Your data lives in a Google Spreadsheet called **"Knots Sheets"** with these columns:

| Date | Title | Link | Type | Notes | Status |
|------|-------|------|------|-------|--------|
| 2026-03-14 09:30 | GitHub - torvalds/linux | https://github.com/... | Code | | Todo |

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- A **Google Cloud** project with Google Sheets API and Google Drive API enabled
- An **OAuth 2.0 Client ID** ([setup guide](#google-cloud-setup))

### Build

```bash
git clone https://github.com/your-username/pincer.git
cd pincer
npm install

# Create .env from the example and add your Google Client ID
cp .env.example .env

# Build for Chrome
npm run build:chrome    # → dist-chrome/

# Build for Firefox
npm run build:firefox   # → dist-firefox/
```

### Install on Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select the `dist-chrome/` folder
4. Pin the Knots icon in your toolbar

### Install on Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** → select any file in `dist-firefox/`

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services**
2. Enable **Google Sheets API** and **Google Drive API**
3. Create **OAuth 2.0 credentials**:
   - **Chrome**: Application type = "Chrome Extension", enter your extension ID
   - **Firefox**: Application type = "Web Application", add `browser.identity.getRedirectURL()` as a redirect URI
4. Copy the Client ID into your `.env` file:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

## Usage

| Action | How |
|---|---|
| **Sign in** | Click Knots icon → **Sign in with Google** |
| **Save a page** | Click Knots icon → **Save Current Page** |
| **Save with notes** | Select text → right-click → **Knots: Save Note** |
| **View spreadsheet** | Click Knots icon → **Open Knots Spreadsheet ↗** |
| **Change target sheet** | Right-click icon → **Options** → set sheet name |
| **Toggle categorization** | Options page → **Smart Categorization** toggle |
| **Clear local cache** | Options page → **Clear Local Cache** |
| **Sign out** | Click Knots icon → **Logout** |

## Tech Stack

| | |
|---|---|
| **Language** | TypeScript (strict mode) |
| **Build** | Vite 8 + `vite-plugin-web-extension` |
| **Styling** | Tailwind CSS v4 |
| **Browser APIs** | `webextension-polyfill` |
| **Testing** | Vitest (30 tests) |
| **APIs** | Google Sheets v4 + Google Drive v3 (direct REST, no client libraries) |

## Project Structure

```
src/
├── background/           # Service worker — auth, API, cache, save logic
├── content/              # Toast notification content script
├── popup/                # Toolbar popup UI
├── options/              # Settings page
├── shared/               # Shared TypeScript types
└── manifest.json         # MV3 manifest

tests/                    # Vitest test suite
.documentation/           # Architecture & onboarding docs
```

## Development

```bash
# Watch mode
npm run dev:chrome
npm run dev:firefox

# Run tests
npm test
npm run test:watch

# Type check
npx tsc --noEmit
```

## Documentation

Detailed internal documentation is available in [.documentation/](.documentation/README.md):

- [Architecture](.documentation/architecture/README.md) — system overview and module map
- [Data Flow](.documentation/data-flow/README.md) — end-to-end traces of every action
- [Authentication](.documentation/authentication/README.md) — OAuth flow and token lifecycle
- [Caching](.documentation/caching/README.md) — URL cache design and consistency model
- [API Layer](.documentation/api/README.md) — Google Sheets/Drive wrapper reference
- [Testing](.documentation/testing/README.md) — test strategy and mock architecture
- [Setup](.documentation/setup/README.md) — detailed developer onboarding

## License

ISC
