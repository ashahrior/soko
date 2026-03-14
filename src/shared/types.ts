/**
 * Shared type definitions for Soko extension messaging and storage.
 */

/** Actions sent via chrome.runtime messages */
export interface SaveMessage {
  action: "save";
  note?: string;
}

export interface ShowToastMessage {
  action: "showToast";
  message: string;
}

export interface LoginMessage {
  action: "login";
}

export interface LogoutMessage {
  action: "logout";
}

export interface GetStatusMessage {
  action: "getStatus";
}

export interface ClearCacheMessage {
  action: "clearCache";
}

export interface EnsureSheetMessage {
  action: "ensureSheet";
  sheetName: string;
}

export type ExtensionMessage =
  | SaveMessage
  | ShowToastMessage
  | LoginMessage
  | LogoutMessage
  | GetStatusMessage
  | ClearCacheMessage
  | EnsureSheetMessage;

/** Shape of per-sheet URL cache stored in chrome.storage.local */
export interface StorageSchema {
  accessToken?: string;
  /** Token expiry as Unix timestamp in milliseconds */
  tokenExpiresAt?: number;
  userEmail?: string;
  spreadsheetId?: string;
  sheetName?: string;
  smartCategorization?: boolean;
  urlCache?: string[];
}

/** A single row destined for the spreadsheet */
export interface SpreadsheetRow {
  date: string;
  title: string;
  link: string;
  type: string;
  notes: string;
  status: string;
}
