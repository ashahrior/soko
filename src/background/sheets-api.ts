import { authenticatedFetch } from "./auth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

/** Escape a value for use inside a Drive API query string literal. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Escape a sheet name for use in A1 range notation (single quotes → doubled). */
export function escapeSheetName(name: string): string {
  return name.replace(/'/g, "''");
}

/** Search Google Drive for a file named `name` (Sheets MIME type). */
export async function searchDriveFile(
  name: string,
): Promise<{ id: string } | null> {
  const safeName = escapeDriveQuery(name);
  const q = encodeURIComponent(
    `name='${safeName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
  );
  const res = await authenticatedFetch(`${DRIVE_FILES}?q=${q}&fields=files(id,name)`);
  if (!res.ok) throw new Error(`Drive search failed: ${res.status}`);
  const data = (await res.json()) as { files: { id: string; name: string }[] };
  return data.files.length > 0 ? { id: data.files[0].id } : null;
}

/** Create a new spreadsheet with the given title and default sheet name. */
export async function createSpreadsheet(
  title: string,
  defaultSheet: string,
): Promise<{ spreadsheetId: string; sheetId: number }> {
  const body = {
    properties: { title },
    sheets: [{ properties: { title: defaultSheet } }],
  };
  const res = await authenticatedFetch(SHEETS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create spreadsheet failed: ${res.status}`);
  const data = (await res.json()) as {
    spreadsheetId: string;
    sheets: { properties: { sheetId: number; title: string } }[];
  };
  return {
    spreadsheetId: data.spreadsheetId,
    sheetId: data.sheets[0].properties.sheetId,
  };
}

/** Get all sheet names in a spreadsheet. */
export async function getSheetNames(
  ssId: string,
): Promise<{ title: string; sheetId: number }[]> {
  const res = await authenticatedFetch(
    `${SHEETS_BASE}/${ssId}?fields=sheets.properties(sheetId,title)`,
  );
  if (!res.ok) throw new Error(`Get sheets failed: ${res.status}`);
  const data = (await res.json()) as {
    sheets: { properties: { sheetId: number; title: string } }[];
  };
  return data.sheets.map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));
}

/** Add a new sheet tab to an existing spreadsheet. */
export async function addSheet(
  ssId: string,
  title: string,
): Promise<number> {
  const body = {
    requests: [{ addSheet: { properties: { title } } }],
  };
  const res = await authenticatedFetch(`${SHEETS_BASE}/${ssId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Add sheet failed: ${res.status}`);
  const data = (await res.json()) as {
    replies: { addSheet: { properties: { sheetId: number } } }[];
  };
  return data.replies[0].addSheet.properties.sheetId;
}

/** Append a row to a sheet. */
export async function appendRow(
  ssId: string,
  sheet: string,
  values: string[],
): Promise<void> {
  const range = encodeURIComponent(`'${escapeSheetName(sheet)}'!A:F`);
  const res = await authenticatedFetch(
    `${SHEETS_BASE}/${ssId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values] }),
    },
  );
  if (!res.ok) throw new Error(`Append row failed: ${res.status}`);
}

/** Update a specific range (used for writing the header row). */
export async function updateRange(
  ssId: string,
  range: string,
  values: string[][],
): Promise<void> {
  const encodedRange = encodeURIComponent(range);
  const res = await authenticatedFetch(
    `${SHEETS_BASE}/${ssId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!res.ok) throw new Error(`Update range failed: ${res.status}`);
}

/** Find a row by URL in column C and return its 1-based row number and current status. */
export async function findRowByUrl(
  ssId: string,
  sheet: string,
  url: string,
): Promise<{ rowNumber: number; status: string } | null> {
  const range = encodeURIComponent(`'${escapeSheetName(sheet)}'!C:F`);
  const res = await authenticatedFetch(
    `${SHEETS_BASE}/${ssId}/values/${range}`,
  );
  if (!res.ok) throw new Error(`Read range failed: ${res.status}`);
  const data = (await res.json()) as { values?: string[][] };
  const rows = data.values ?? [];
  // Skip header (index 0); column C is index 0 in range, Status (F) is index 3
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === url) {
      return { rowNumber: i + 1, status: rows[i][3] ?? "Todo" };
    }
  }
  return null;
}

/** Read a single column (used for URL cache sync). */
export async function readColumn(
  ssId: string,
  sheet: string,
  column: string,
): Promise<string[]> {
  const range = encodeURIComponent(`'${escapeSheetName(sheet)}'!${column}:${column}`);
  const res = await authenticatedFetch(
    `${SHEETS_BASE}/${ssId}/values/${range}`,
  );
  if (!res.ok) throw new Error(`Read column failed: ${res.status}`);
  const data = (await res.json()) as { values?: string[][] };
  // Flatten + skip header row
  return (data.values ?? []).slice(1).map((row) => row[0] ?? "");
}

/** Format the header row: bold white text on dark blue background, frozen. */
export async function formatHeaderRow(
  ssId: string,
  sheetId: number,
): Promise<void> {
  const body = {
    requests: [
      // Bold white text on dark blue background
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 0.102,
                green: 0.137,
                blue: 0.494,
              },
              textFormat: {
                bold: true,
                foregroundColor: {
                  red: 1,
                  green: 1,
                  blue: 1,
                },
              },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      },
      // Freeze header row
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: "gridProperties.frozenRowCount",
        },
      },
    ],
  };
  const res = await authenticatedFetch(`${SHEETS_BASE}/${ssId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Format header failed: ${res.status}`);
}

/** Set data validation (dropdown) on a column. */
export async function setDataValidation(
  ssId: string,
  sheetId: number,
  columnIndex: number,
  options: string[],
): Promise<void> {
  const body = {
    requests: [
      {
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1,
          },
          rule: {
            condition: {
              type: "ONE_OF_LIST",
              values: options.map((v) => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict: true,
          },
        },
      },
    ],
  };
  const res = await authenticatedFetch(`${SHEETS_BASE}/${ssId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Set validation failed: ${res.status}`);
}

/**
 * Add conditional formatting rules for the Status column.
 * Idempotent: deletes any existing conditional format rules on the sheet first.
 * - "Todo"        → light grey background (columns A through Status)
 * - "In progress" → light red background
 * - "Done"        → light green background
 */
export async function setConditionalFormatting(
  ssId: string,
  sheetId: number,
  statusColumnIndex: number,
  statusOptions: string[],
): Promise<void> {
  // Map status values to background colours
  const colorMap: Record<string, { red: number; green: number; blue: number }> = {
    Todo:          { red: 0.85, green: 0.85, blue: 0.85 },
    "In progress": { red: 0.96, green: 0.80, blue: 0.80 },
    Done:          { red: 0.85, green: 0.94, blue: 0.85 },
  };

  // ── 1. Fetch existing conditional format rules so we can clear them ──
  const metaRes = await authenticatedFetch(
    `${SHEETS_BASE}/${ssId}?fields=sheets(properties.sheetId,conditionalFormats)`,
  );
  if (!metaRes.ok) throw new Error(`Fetch sheet metadata failed: ${metaRes.status}`);
  const meta = (await metaRes.json()) as {
    sheets: {
      properties: { sheetId: number };
      conditionalFormats?: unknown[];
    }[];
  };
  const targetSheet = meta.sheets.find((s) => s.properties.sheetId === sheetId);
  const existingCount = targetSheet?.conditionalFormats?.length ?? 0;

  // Build delete requests (in reverse index order to avoid shifting)
  const deleteRequests = Array.from({ length: existingCount }, (_, i) => ({
    deleteConditionalFormatRule: {
      sheetId,
      index: existingCount - 1 - i,
    },
  }));

  // ── 2. Build add requests ──
  const statusColLetter = String.fromCharCode(65 + statusColumnIndex);

  const addRequests = statusOptions
    .map((status, index) => {
      const bg = colorMap[status];
      if (!bg) return null;
      return {
        addConditionalFormatRule: {
          rule: {
            ranges: [
              {
                sheetId,
                startRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: statusColumnIndex + 1,
              },
            ],
            booleanRule: {
              condition: {
                type: "CUSTOM_FORMULA" as const,
                values: [
                  {
                    userEnteredValue: `=$${statusColLetter}2="${status}"`,
                  },
                ],
              },
              format: {
                backgroundColor: bg,
              },
            },
          },
          index,
        },
      };
    })
    .filter(Boolean);

  if (addRequests.length === 0) return;

  // ── 3. Send deletes + adds in a single batchUpdate ──
  const body = { requests: [...deleteRequests, ...addRequests] };
  const res = await authenticatedFetch(`${SHEETS_BASE}/${ssId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Set conditional formatting failed: ${res.status}`);
}
