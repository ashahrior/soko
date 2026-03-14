import browser from "webextension-polyfill";
import type { StorageSchema } from "../shared/types";
import {
  searchDriveFile,
  createSpreadsheet,
  getSheetNames,
  addSheet,
  updateRange,
  setDataValidation,
  escapeSheetName,
} from "./sheets-api";

const HEADER_ROW = ["Date", "Title", "Link", "Type", "Notes", "Status"];
const STATUS_OPTIONS = ["Todo", "In progress", "Done"];
const DEFAULT_SHEET_NAME = "Default";

/** Get current target sheet name from storage (or fallback to "Default"). */
export async function getSheetName(): Promise<string> {
  const data = (await browser.storage.local.get("sheetName")) as StorageSchema;
  return data.sheetName ?? DEFAULT_SHEET_NAME;
}

/**
 * Initialise the Soko spreadsheet:
 *  1. Search Drive for existing "Soko" spreadsheet
 *  2. Create if not found
 *  3. Store spreadsheetId in local storage
 *  4. Ensure the target sheet exists with header + validation
 */
export async function initSpreadsheet(): Promise<string> {
  // Check if we already have a stored ID
  const stored = (await browser.storage.local.get(
    "spreadsheetId",
  )) as StorageSchema;
  if (stored.spreadsheetId) {
    // Verify the sheet exists within it
    const sheetName = await getSheetName();
    await ensureSheet(stored.spreadsheetId, sheetName);
    return stored.spreadsheetId;
  }

  const sheetName = await getSheetName();

  // Search for existing
  const existing = await searchDriveFile("Soko");
  if (existing) {
    await browser.storage.local.set({ spreadsheetId: existing.id });
    await ensureSheet(existing.id, sheetName);
    return existing.id;
  }

  // Create new
  const { spreadsheetId, sheetId } = await createSpreadsheet("Soko", sheetName);
  await browser.storage.local.set({ spreadsheetId });

  // Write header row
  await updateRange(spreadsheetId, `'${escapeSheetName(sheetName)}'!A1:F1`, [HEADER_ROW]);

  // Set status column validation (column index 5 = F)
  await setDataValidation(spreadsheetId, sheetId, 5, STATUS_OPTIONS);

  return spreadsheetId;
}

/**
 * Ensure a named sheet exists in the spreadsheet.
 * Creates it + writes header + adds status validation if missing.
 */
export async function ensureSheet(
  ssId: string,
  name: string,
): Promise<void> {
  const sheets = await getSheetNames(ssId);
  const found = sheets.find((s) => s.title === name);
  if (found) return; // already exists

  const sheetId = await addSheet(ssId, name);
  await updateRange(ssId, `'${escapeSheetName(name)}'!A1:F1`, [HEADER_ROW]);
  await setDataValidation(ssId, sheetId, 5, STATUS_OPTIONS);
}
