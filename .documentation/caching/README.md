# Caching

## Overview

Knots maintains a client-side URL cache for instant duplicate detection. This avoids a Google Sheets API call on every save attempt — lookups are O(1) against an in-memory `Set<string>`.

## Architecture

```
              In-memory (runtime)            Persistent (storage)
              ┌──────────────┐               ┌────────────────────┐
              │  Set<string>  │◀── loadCache ──│ chrome.storage.local│
              │  (urlSet)     │── persistCache─▶│ { urlCache: [...] }│
              └──────┬───────┘               └────────────────────┘
                     │
              hasUrl() — O(1)
              addUrl() — O(1) + persist
```

**Module:** `src/background/cache-manager.ts`

## Data Structures

| Layer | Structure | Contents |
|---|---|---|
| Memory | `Set<string>` | All saved URLs (e.g. `"https://example.com/page"`) |
| Storage | `string[]` at key `urlCache` | Serialized array of all URLs |

## Operations

### `loadCache()`

Called on **extension install** and **browser startup**. Reads the `urlCache` array from `chrome.storage.local` and populates the in-memory `Set`.

```
browser.runtime.onInstalled → loadCache()
browser.runtime.onStartup  → loadCache()
```

### `syncCache()`

Full re-sync from the Google Spreadsheet. Reads **Column C** (the "Link" column) from the active sheet using `readColumn()`, then replaces the entire in-memory Set and persists.

Called in three scenarios:
1. **After login** — `login() → initSpreadsheet() → syncCache()`  
2. **After "Clear Cache"** in the options page — the user triggers a manual resync
3. **Popup "Sync" button** — user clicks the Sync button on the main popup view to refresh the cache on demand

This is intentionally **not** called on every startup to avoid unnecessary API calls.

### `hasUrl(url)`

Synchronous O(1) lookup. Returns `true` if the URL is in the in-memory Set. Used by `handleSave()` for duplicate detection and `updateBadge()` for the peek indicator.

### `addUrl(url)`

Adds a URL after a successful save. Updates both the in-memory Set and persists the updated array to storage.

### `clearCache()`

Wipes the in-memory Set and removes the `urlCache` key from storage. After this, `syncCache()` should be called to rebuild from the spreadsheet.

## Lifecycle

```
Extension Install / Update
  └── loadCache() ← restores Set from storage
  └── syncCache() ← full rebuild from Sheet (if logged in)

Browser Startup
  └── loadCache() ← restores Set from storage

Every Save
  └── hasUrl(url) ← duplicate check
  └── addUrl(url) ← if save succeeded

Popup: "Sync" button
  └── syncCache() ← full rebuild from Sheet
  └── re-checks page status afterwards

Options: "Clear Cache"
  └── clearCache() ← wipe
  └── (user should resync by reloading)
```

## Consistency Guarantees

The cache is **eventually consistent** with the spreadsheet:
- **Additions** are reflected immediately (addUrl after each save)
- **External edits** (rows deleted directly in Google Sheets) are *not* detected until a full `syncCache()`
- **Cross-device** changes are not synced (cache is local to the browser instance)

The cache is designed for *performance* (avoiding API calls), not as a source of truth. The spreadsheet is always authoritative.

## Storage Size

Each URL averages ~80 bytes. At 10,000 saved URLs, the cache occupies ~800 KB in `chrome.storage.local` (well under the 10 MB quota for MV3 extensions).
