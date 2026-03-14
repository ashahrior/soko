import browser from "webextension-polyfill";
import type { StorageSchema } from "../shared/types";
import { readColumn } from "./sheets-api";
import { getSheetName } from "./spreadsheet-manager";

let urlSet: Set<string> = new Set();

/** Load the URL cache from local storage into memory. */
export async function loadCache(): Promise<void> {
  const data = (await browser.storage.local.get("urlCache")) as StorageSchema;
  urlSet = new Set(data.urlCache ?? []);
}

/**
 * Sync cache from the spreadsheet (Column C = Link).
 * Call sparingly — only on install or manual cache clear.
 */
export async function syncCache(): Promise<void> {
  const data = (await browser.storage.local.get(
    "spreadsheetId",
  )) as StorageSchema;
  if (!data.spreadsheetId) return;

  const sheetName = await getSheetName();
  const urls = await readColumn(data.spreadsheetId, sheetName, "C");
  urlSet = new Set(urls);
  await persistCache();
}

/** Check if a URL is already saved. */
export function hasUrl(url: string): boolean {
  return urlSet.has(url);
}

/** Add a URL to the cache and persist. */
export async function addUrl(url: string): Promise<void> {
  urlSet.add(url);
  await persistCache();
}

/** Clear the in-memory and persisted cache. */
export async function clearCache(): Promise<void> {
  urlSet.clear();
  await browser.storage.local.remove("urlCache");
}

/** Persist the current Set to storage. */
async function persistCache(): Promise<void> {
  await browser.storage.local.set({
    urlCache: Array.from(urlSet),
  } satisfies Partial<StorageSchema>);
}
