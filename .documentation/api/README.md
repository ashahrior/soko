# API Layer

## Overview

Knots communicates with two Google APIs via REST (no client libraries):

| API | Base URL | Purpose |
|---|---|---|
| Google Drive API v3 | `https://www.googleapis.com/drive/v3/files` | Search for existing "Knots Sheets" spreadsheet |
| Google Sheets API v4 | `https://sheets.googleapis.com/v4/spreadsheets` | All spreadsheet CRUD operations |

All API calls go through `authenticatedFetch()` (see [Authentication](../authentication/README.md)), which handles token injection and 401 retry.

**Module:** `src/background/sheets-api.ts`

## Functions Reference

### Drive API

#### `searchDriveFile(name: string): Promise<{ id: string } | null>`

Searches Drive for a spreadsheet with the given name. Used during `initSpreadsheet()` to find an existing "Knots Sheets" spreadsheet.

```
GET /drive/v3/files?q=name='Knots Sheets' and mimeType='...' and trashed=false&fields=files(id,name)
```

**Security:** The `name` parameter is escaped via `escapeDriveQuery()` which handles backslash and single-quote injection.

### Sheets API

#### `createSpreadsheet(title, defaultSheet): Promise<{ spreadsheetId, sheetId }>`

Creates a new spreadsheet with one sheet tab.

```
POST /v4/spreadsheets
Body: { properties: { title }, sheets: [{ properties: { title: defaultSheet } }] }
```

#### `getSheetNames(ssId): Promise<{ title, sheetId }[]>`

Lists all sheet tabs in a spreadsheet.

```
GET /v4/spreadsheets/{ssId}?fields=sheets.properties(sheetId,title)
```

#### `addSheet(ssId, title): Promise<number>`

Adds a new sheet tab. Returns the new `sheetId`.

```
POST /v4/spreadsheets/{ssId}:batchUpdate
Body: { requests: [{ addSheet: { properties: { title } } }] }
```

#### `appendRow(ssId, sheet, values: string[]): void`

Appends a single row to columns A–F. The primary write operation for saving pages.

```
POST /v4/spreadsheets/{ssId}/values/{range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS
Body: { values: [values] }
```

**Security:** Sheet name is escaped via `escapeSheetName()` (doubles single quotes per A1 notation rules).

#### `updateRange(ssId, range, values: string[][]): void`

Writes data to a specific range. Used for writing the header row (`A1:F1`) on new sheets and for updating individual cell values (e.g. Status column updates via `updateStatus`).

```
PUT /v4/spreadsheets/{ssId}/values/{range}?valueInputOption=USER_ENTERED
```

#### `findRowByUrl(ssId, sheet, url): Promise<{ rowNumber, status } | null>`

Searches Column C for a matching URL and returns its 1-based row number and current Status value (Column F). Used by the `getPageStatus` message handler to check if the current page is saved and what its status is.

```
GET /v4/spreadsheets/{ssId}/values/{range}  (reads C:F)
```

Returns `null` if the URL is not found. Skips the header row.

#### `readColumn(ssId, sheet, column): Promise<string[]>`

Reads all values from a single column. Used for cache sync (reads Column C = URLs). Skips the header row.

```
GET /v4/spreadsheets/{ssId}/values/{range}
```

#### `setDataValidation(ssId, sheetId, columnIndex, options): void`

Sets a dropdown validation rule on a column (starting at row 2). Used for the "Status" column (Todo / In progress / Done).

```
POST /v4/spreadsheets/{ssId}:batchUpdate
Body: { requests: [{ setDataValidation: { range, rule } }] }
```

#### `setupNewSheetFormatting(ssId, sheetId, statusColumnIndex, statusOptions): void`

Sets up all formatting for a new sheet in a **single** `batchUpdate` call: header formatting (bold white text on dark blue, frozen row), data validation dropdown, and conditional formatting (row colours based on Status). Replaces what would otherwise be 3 separate API calls.

```
POST /v4/spreadsheets/{ssId}:batchUpdate
Body: { requests: [...headerFormat, ...dataValidation, ...conditionalFormat] }
```

This is the preferred function for new sheet setup. The individual functions (`formatHeaderRow`, `setDataValidation`, `setConditionalFormatting`) are still exported for standalone use.

#### `formatHeaderRow(ssId, sheetId): void`

Formats the header row: bold white text on dark blue background, frozen first row.

```
POST /v4/spreadsheets/{ssId}:batchUpdate
```

#### `setConditionalFormatting(ssId, sheetId, statusColumnIndex, statusOptions): void`

Adds conditional formatting rules for the Status column. Idempotent — deletes any existing conditional format rules on the sheet first, then adds:
- "Todo" → light grey row background
- "In progress" → light red row background
- "Done" → light green row background

Colours are applied to columns A through Status (A–F).

## Helper Functions

### `escapeSheetName(name: string): string`

Doubles single quotes in sheet names for safe use in A1 notation ranges.

```typescript
"Tom's Sheet" → "Tom''s Sheet"
// Used as: 'Tom''s Sheet'!A:F
```

### `escapeDriveQuery(value: string): string`

Escapes `\` and `'` for safe interpolation into Drive API query strings.

```typescript
"Tom's File" → "Tom\\'s File"
// Used in: name='Tom\\'s File'
```

## Error Handling

All API functions follow a consistent pattern:
1. Call `authenticatedFetch()` (handles auth + 401 retry)
2. Check `res.ok`
3. On failure: throw `Error` with descriptive message including the HTTP status code
4. On success: parse JSON response with a typed assertion

Callers (mainly `handleSave()` in `index.ts`) catch these errors and surface them as user-facing toast notifications.

## Spreadsheet Manager

**Module:** `src/background/spreadsheet-manager.ts`

Orchestrates the sheets-api functions for higher-level operations:

| Function | Purpose |
|---|---|
| `getSheetName()` | Read target sheet name from storage (default: `"Default"`) |
| `initSpreadsheet()` | Find-or-create the "Knots Sheets" spreadsheet, ensure sheet exists. Returns `{ spreadsheetId, sheetNames }` so callers can cache sheet names without an extra API call. |
| `ensureSheet(ssId, name)` | Create sheet tab + header + full formatting if it doesn't exist. Returns `string[]` of all sheet names (for caching). |

### `initSpreadsheet()` Flow

```
1. Already have spreadsheetId? → ensureSheet() → return { spreadsheetId, sheetNames }
2. searchDriveFile("Knots Sheets") → found? → store ID → ensureSheet() → return
3. createSpreadsheet("Knots Sheets", sheetName) → store ID → writeHeader → setupNewSheetFormatting() → return { spreadsheetId, sheetNames }
```

If a stored spreadsheetId exists but the spreadsheet is inaccessible (deleted), the stale ID is cleared and the flow falls through to search/create.
