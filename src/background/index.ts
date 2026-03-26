import browser from "webextension-polyfill";
import type { ExtensionMessage, StorageSchema } from "../shared/types";
import { login, logout, isTokenValid } from "./auth";
import { initSpreadsheet, getSheetName, ensureSheet } from "./spreadsheet-manager";
import { loadCache, syncCache, hasUrl, addUrl, clearCache } from "./cache-manager";
import { categorize } from "./categorizer";
import { registerContextMenu, onContextMenuClick } from "./context-menu";
import { appendRow, getSheetNames, setDataValidation, findRowByUrl, updateRange, escapeSheetName } from "./sheets-api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function sendToast(tabId: number, message: string): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { action: "showToast", message });
  } catch {
    // Content script may not be injected (e.g. chrome:// pages) — ignore
  }
}

async function isSmartCategorizationEnabled(): Promise<boolean> {
  const data = (await browser.storage.local.get(
    "smartCategorization",
  )) as StorageSchema;
  return data.smartCategorization !== false; // default true
}

// ─── Save Pipeline ──────────────────────────────────────────────────────────

async function handleSave(
  tab: browser.Tabs.Tab,
  note = "",
): Promise<void> {
  if (!tab.url || !tab.id) return;

  const stored = (await browser.storage.local.get(
    "spreadsheetId",
  )) as StorageSchema;
  if (!stored.spreadsheetId) {
    await sendToast(tab.id, "Please sign in first.");
    return;
  }

  // Duplicate check
  if (hasUrl(tab.url)) {
    await sendToast(tab.id, "Already saved ✓");
    return;
  }

  const smartEnabled = await isSmartCategorizationEnabled();
  const type = categorize(tab.url, smartEnabled);
  const sheetName = await getSheetName();

  const row = [
    formatDate(new Date()),
    tab.title ?? "",
    tab.url,
    type,
    note,
    "Todo",
  ];

  try {
    await appendRow(stored.spreadsheetId, sheetName, row);

    // Re-apply status column validation to cover all rows (including any
    // previously inserted without validation)
    const sheets = await getSheetNames(stored.spreadsheetId);
    const sheet = sheets.find((s) => s.title === sheetName);
    if (sheet) {
      await setDataValidation(stored.spreadsheetId, sheet.sheetId, 5, ["Todo", "In progress", "Done"]);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await sendToast(tab.id, `Save failed: ${msg}`);
    return;
  }

  await addUrl(tab.url);
  await sendToast(tab.id, "Saved ✓");
  await updateBadge(tab.id, tab.url);
}

// ─── Peek Indicator (Badge) ─────────────────────────────────────────────────

async function updateBadge(tabId: number, url?: string): Promise<void> {
  try {
    if (url && hasUrl(url)) {
      await browser.action.setBadgeText({ text: "✓", tabId });
      await browser.action.setBadgeBackgroundColor({
        color: "#4CAF50",
        tabId,
      });
    } else {
      await browser.action.setBadgeText({ text: "", tabId });
    }
  } catch {
    // Tab may have been closed before the badge update could run — ignore
  }
}

// ─── Event Listeners ────────────────────────────────────────────────────────

// Install / Update
browser.runtime.onInstalled.addListener(async () => {
  registerContextMenu();
  await loadCache();
  // Sync with sheet if already authenticated
  try {
    await syncCache();
  } catch {
    // Not logged in yet — that's fine
  }
});

// Startup (browser reopen)
browser.runtime.onStartup?.addListener(async () => {
  await loadCache();
});

// Tab activated — update badge
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    await updateBadge(activeInfo.tabId, tab.url);
  } catch {
    // Tab may not exist
  }
});

// Tab navigated — update badge
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    await updateBadge(tabId, tab.url);
  }
});

// Context menu
onContextMenuClick(async (tab, selectionText) => {
  await handleSave(tab, selectionText);
});

// Message handler (from popup / options)
browser.runtime.onMessage.addListener(
  (
    msg: unknown,
    _sender: browser.Runtime.MessageSender,
  ): Promise<unknown> | undefined => {
    const message = msg as ExtensionMessage;
    switch (message.action) {
      case "save":
        return (async () => {
          const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tab) await handleSave(tab, message.note);
          return { success: true };
        })();

      case "login":
        return (async () => {
          try {
            console.log("[knots] login: starting...");
            const { email } = await login();
            console.log("[knots] login: success, email=", email);
            await initSpreadsheet();
            console.log("[knots] login: spreadsheet initialized");
            await syncCache();
            console.log("[knots] login: cache synced");
            // Cache sheet names on first login
            const stored = (await browser.storage.local.get("spreadsheetId")) as StorageSchema;
            if (stored.spreadsheetId) {
              const sheets = await import("./sheets-api").then((m) =>
                m.getSheetNames(stored.spreadsheetId!),
              );
              await browser.storage.local.set({
                cachedSheetNames: sheets.map((s) => s.title),
              });
            }
            return { success: true, email };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[knots] login error:", msg, err);
            return { success: false, error: msg };
          }
        })();

      case "logout":
        return (async () => {
          await logout();
          return { success: true };
        })();

      case "getStatus":
        return (async () => {
          const data = (await browser.storage.local.get([
            "userEmail",
            "spreadsheetId",
            "accessToken",
          ])) as StorageSchema;
          const tokenValid = !!data.accessToken && await isTokenValid();
          return {
            loggedIn: tokenValid,
            email: data.userEmail ?? null,
            spreadsheetId: data.spreadsheetId ?? null,
          };
        })();

      case "clearCache":
        return (async () => {
          await clearCache();
          return { success: true };
        })();

      case "ensureSheet":
        return (async () => {
          const stored = (await browser.storage.local.get(
            "spreadsheetId",
          )) as StorageSchema;
          if (stored.spreadsheetId) {
            await ensureSheet(stored.spreadsheetId, message.sheetName);
            await browser.storage.local.set({ sheetName: message.sheetName });
          }
          return { success: true };
        })();

      case "getSheets":
        return (async () => {
          const stored = (await browser.storage.local.get([
            "spreadsheetId",
            "cachedSheetNames",
          ])) as StorageSchema;
          if (!stored.spreadsheetId) return { sheets: [] };

          // Return cached list unless forceRefresh is requested
          if (!message.forceRefresh && stored.cachedSheetNames?.length) {
            return { sheets: stored.cachedSheetNames };
          }

          const sheets = await import("./sheets-api").then((m) =>
            m.getSheetNames(stored.spreadsheetId!),
          );
          const names = sheets.map((s) => s.title);
          await browser.storage.local.set({ cachedSheetNames: names });
          return { sheets: names };
        })();

      case "getPageStatus":
        return (async () => {
          const stored = (await browser.storage.local.get(
            "spreadsheetId",
          )) as StorageSchema;
          if (!stored.spreadsheetId) return { found: false };
          const sheetName = await getSheetName();
          const result = await findRowByUrl(
            stored.spreadsheetId,
            sheetName,
            message.url,
          );
          if (!result) return { found: false };
          return { found: true, status: result.status };
        })();

      case "updateStatus":
        return (async () => {
          const stored = (await browser.storage.local.get(
            "spreadsheetId",
          )) as StorageSchema;
          if (!stored.spreadsheetId)
            return { success: false, error: "Not signed in" };
          const sheetName = await getSheetName();
          const result = await findRowByUrl(
            stored.spreadsheetId,
            sheetName,
            message.url,
          );
          if (!result)
            return { success: false, error: "URL not found in sheet" };
          const range = `'${escapeSheetName(sheetName)}'!F${result.rowNumber}`;
          await updateRange(stored.spreadsheetId, range, [[message.status]]);
          return { success: true };
        })();

      case "syncCache":
        return (async () => {
          try {
            await syncCache();
            return { success: true };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
          }
        })();

      default:
        return undefined;
    }
  },
);
