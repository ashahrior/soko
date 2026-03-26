# Data Flow

This document traces the end-to-end flow of every major user action in Knots.

## 1. One-Click Save

```
User clicks toolbar icon ──▶ Popup opens ──▶ User clicks "Save Current Page"
                                                       │
                  ┌────────────────────────────────────┘
                  ▼
Popup sends { action: "save" } via browser.runtime.sendMessage()
                  │
                  ▼
Background index.ts onMessage handler
  → queries active tab
  → calls handleSave(tab)
                  │
                  ▼
handleSave(tab):
  1. Check tab.url and tab.id exist
  2. Read spreadsheetId from storage → abort if not logged in
  3. hasUrl(tab.url) → if true, sendToast("Already saved ✓") and return
  4. Determine category: categorize(url, smartEnabled)
  5. Get target sheet name: getSheetName()
  6. Build row: [date, title, url, type, "", "Todo"]
  7. appendRow(spreadsheetId, sheetName, row)
     └── authenticatedFetch() → POST to Sheets API
         └── If 401 → silent token refresh → retry
  8. addUrl(tab.url) — updates in-memory Set + persists to storage
  9. sendToast(tab.id, "Saved ✓")
  10. updateBadge(tab.id, tab.url) — shows green ✓
```

## 2. Right-Click Save with Note

```
User selects text on page → right-clicks → selects "Knots: Save Note"
                  │
                  ▼
browser.contextMenus.onClicked fires
  → onContextMenuClick callback receives (tab, selectionText)
  → calls handleSave(tab, selectionText)
                  │
                  ▼
Same flow as One-Click Save, except:
  - Row column 5 (Notes) contains the selected text
```

## 3. Login Flow

```
Popup sends { action: "login" }
                  │
                  ▼
Background: login()
  ├── Chrome: chrome.identity.getAuthToken({ interactive: true })
  │   └── Returns token (Chrome manages the OAuth UI)
  └── Firefox: browser.identity.launchWebAuthFlow(authUrl)
      └── Parses token + expires_in from redirect URL hash
                  │
                  ▼
Store accessToken + tokenExpiresAt + userEmail in chrome.storage.local
                  │
                  ▼
initSpreadsheet()
  1. Check storage for existing spreadsheetId
  2. If none: searchDriveFile("Knots Sheets") via Drive API
  3. If none found: createSpreadsheet("Knots Sheets", "Default") via Sheets API
  4. ensureSheet() → write header row + setupNewSheetFormatting()
  5. Store spreadsheetId
  6. Returns { spreadsheetId, sheetNames }
                  │
                  ▼
syncCache()
  1. readColumn(spreadsheetId, sheetName, "C") — fetch all URLs
  2. Rebuild urlSet = new Set(urls)
  3. Persist to storage as string[]
                  │
                  ▼
Cache sheet names in chrome.storage.local (cachedSheetNames)
                  │
                  ▼
Return { success: true, email } → Popup shows logged-in view
```

## 4. Logout Flow

```
Popup sends { action: "logout" }
                  │
                  ▼
Background: logout()
  1. Read accessToken from storage
  2. Chrome only: chrome.identity.removeCachedAuthToken()
  3. Remove auth/settings storage keys:
     accessToken, tokenExpiresAt, userEmail,
     urlCache, sheetName, smartCategorization
     (spreadsheetId and cachedSheetNames are intentionally preserved
      so re-login reconnects to the same spreadsheet)
                  │
                  ▼
Popup switches to logged-out view
```

## 5. Peek Indicator (Badge Update)

```
Tab activated / Tab navigation completes
                  │
                  ▼
updateBadge(tabId, url)
  → hasUrl(url) checks in-memory Set
  → If found: setBadgeText("✓") + green background
  → If not:   setBadgeText("") (clear)
```

The badge is updated on:
- `browser.tabs.onActivated` — user switches tabs
- `browser.tabs.onUpdated` with `changeInfo.status === "complete"` — page finishes loading
- After a successful save — immediately reflects the new state

## 6. Page Status Tracking

When the popup opens on a page that has already been saved, it shows status-aware action buttons instead of the save button.

```
Popup opens → loadStatus() → checkPageStatus()
                  │
                  ▼
Popup sends { action: "getPageStatus", url: tab.url }
                  │
                  ▼
Background: getSheetName() → findRowByUrl(ssId, sheet, url)
  → Reads columns C:F, scans for matching URL
  → Returns { found: true, status: "Todo" | "In progress" | "Done" }
     or { found: false }
                  │
                  ▼
Popup renders based on status:
  • Not found → Show save button
  • "Todo"         → Show "Viewing" + "Done" buttons
  • "In progress"  → Show "Done" button only
  • "Done"         → Show static "Done" badge
```

### Updating Status

```
User clicks "Viewing" or "Done"
                  │
                  ▼
Popup sends { action: "updateStatus", url, status: "In progress" | "Done" }
                  │
                  ▼
Background:
  1. findRowByUrl(ssId, sheetName, url) → get row number
  2. updateRange(ssId, "'Sheet'!F{row}", [[newStatus]])
                  │
                  ▼
Popup updates UI (hides/shows buttons accordingly)
```

## 7. Sync Cache (from popup)

```
User clicks "Sync" button in popup
                  │
                  ▼
Popup sends { action: "syncCache" }
                  │
                  ▼
Background: syncCache()
  1. readColumn(spreadsheetId, sheetName, "C") — fetch all URLs
  2. Rebuild urlSet = new Set(urls)
  3. Persist to storage as string[]
                  │
                  ▼
Return { success: true } → Popup re-checks page status
```

## 8. Sheet Name Management

```
Popup settings: user selects/types a sheet name → clicks "Save"
                  │
                  ▼
Popup sends { action: "ensureSheet", sheetName }
                  │
                  ▼
Background:
  1. ensureSheet(ssId, name) → creates sheet tab + formatting if needed
  2. Store sheetName in chrome.storage.local
                  │
                  ▼
Popup refreshes sheet list: sends { action: "getSheets", forceRefresh: true }
```

### Sheet List Caching

```
Popup sends { action: "getSheets", forceRefresh? }
                  │
                  ▼
Background:
  • If !forceRefresh && cachedSheetNames exist → return cached
  • Else: getSheetNames(ssId) → store in cachedSheetNames → return
```

Sheet names are also cached during login (from `initSpreadsheet()` return value).

## 9. Message Flow Summary

| Sender | Message | Background Handler | Side Effects |
|---|---|---|---|
| Popup | `{ action: "save" }` | `handleSave(tab)` | Sheet append, cache update, toast, badge |
| Popup | `{ action: "login" }` | `login() + initSpreadsheet() + syncCache()` | Token storage, spreadsheet init, cache sheet names |
| Popup | `{ action: "logout" }` | `logout()` | Token revoke, storage wipe |
| Popup | `{ action: "getStatus" }` | Read storage + `isTokenValid()` | Returns `{ loggedIn, email, spreadsheetId }` |
| Popup | `{ action: "getPageStatus", url }` | `findRowByUrl()` | Returns `{ found, status }` |
| Popup | `{ action: "updateStatus", url, status }` | `findRowByUrl()` + `updateRange()` | Writes status to column F |
| Popup | `{ action: "syncCache" }` | `syncCache()` | Rebuilds URL cache from spreadsheet |
| Popup | `{ action: "getSheets", forceRefresh? }` | Read cached or `getSheetNames()` | Returns `{ sheets: string[] }` |
| Popup | `{ action: "ensureSheet", sheetName }` | `ensureSheet()` + store name | Create sheet tab if needed |
| Options | `{ action: "clearCache" }` | `clearCache()` | Wipe urlSet + storage |
| Background → Content | `{ action: "showToast", message }` | N/A (content script receives) | DOM injection |
