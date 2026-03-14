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
    `${SHEETS_BASE}/${ssId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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
