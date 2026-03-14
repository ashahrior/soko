# Data Flow

This document traces the end-to-end flow of every major user action in Soko.

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
User selects text on page → right-clicks → selects "Soko: Save Note"
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
  2. If none: searchDriveFile("Soko") via Drive API
  3. If none found: createSpreadsheet("Soko", "Default") via Sheets API
  4. ensureSheet() → write header row + set status validation
  5. Store spreadsheetId
                  │
                  ▼
syncCache()
  1. readColumn(spreadsheetId, sheetName, "C") — fetch all URLs
  2. Rebuild urlSet = new Set(urls)
  3. Persist to storage as string[]
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
  2. POST to Google token revoke endpoint (best-effort, catch errors)
  3. Chrome only: chrome.identity.removeCachedAuthToken()
  4. Remove ALL storage keys:
     accessToken, tokenExpiresAt, userEmail,
     spreadsheetId, urlCache, sheetName, smartCategorization
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

## 6. Message Flow Summary

| Sender | Message | Background Handler | Side Effects |
|---|---|---|---|
| Popup | `{ action: "save" }` | `handleSave(tab)` | Sheet append, cache update, toast, badge |
| Popup | `{ action: "login" }` | `login() + initSpreadsheet() + syncCache()` | Token storage, spreadsheet init |
| Popup | `{ action: "logout" }` | `logout()` | Token revoke, storage wipe |
| Popup | `{ action: "getStatus" }` | Read storage + `isTokenValid()` | Returns `{ loggedIn, email, spreadsheetId }` |
| Options | `{ action: "clearCache" }` | `clearCache()` | Wipe urlSet + storage |
| Options | `{ action: "ensureSheet", sheetName }` | `ensureSheet()` + store name | Create sheet tab if needed |
| Background → Content | `{ action: "showToast", message }` | N/A (content script receives) | DOM injection |
