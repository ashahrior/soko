import browser from "webextension-polyfill";
import type { StorageSchema } from "../shared/types";

// ─── Main view elements ─────────────────────────────────────────────────────
const loggedOutEl = document.getElementById("logged-out")!;
const loggedInEl = document.getElementById("logged-in")!;
const statusEl = document.getElementById("status")!;
const emailEl = document.getElementById("user-email")!;
const linkSheetEl = document.getElementById("link-sheet") as HTMLAnchorElement;
const btnLogin = document.getElementById("btn-login")!;
const btnSave = document.getElementById("btn-save")!;
const btnLogout = document.getElementById("btn-logout")!;
const btnSettings = document.getElementById("btn-settings")!;
const viewMain = document.getElementById("view-main")!;
const viewSettings = document.getElementById("view-settings")!;
const btnBack = document.getElementById("btn-back")!;

// ─── Saved-page action elements ─────────────────────────────────────────────
const savedActionsEl = document.getElementById("saved-actions")!;
const doneBadgeEl = document.getElementById("done-badge")!;
const btnViewing = document.getElementById("btn-viewing")!;
const btnMarkDone = document.getElementById("btn-mark-done")!;

/** URL of the current active tab (populated during loadStatus). */
let currentPageUrl: string | null = null;

// ─── Settings elements ──────────────────────────────────────────────────────
const sheetNameInput = document.getElementById("sheet-name") as HTMLInputElement;
const sheetList = document.getElementById("sheet-list") as HTMLDataListElement;
const btnSaveSheet = document.getElementById("btn-save-sheet")!;
const sheetStatus = document.getElementById("sheet-status")!;
const toggleSmart = document.getElementById("toggle-smart") as HTMLInputElement;
const btnClearCache = document.getElementById("btn-clear-cache")!;
const cacheStatus = document.getElementById("cache-status")!;
const btnSyncSheets = document.getElementById("btn-sync-sheets")!;

// ─── Sync cache elements ────────────────────────────────────────────────────
const btnSync = document.getElementById("btn-sync")!;
const syncIcon = document.getElementById("sync-icon")!;
const syncText = document.getElementById("sync-text")!;

// ─── View management ────────────────────────────────────────────────────────

function showView(view: "logged-out" | "logged-in" | "loading") {
  loggedOutEl.classList.toggle("hidden", view !== "logged-out");
  loggedInEl.classList.toggle("hidden", view !== "logged-in");
  statusEl.classList.toggle("hidden", view !== "loading");
  if (view !== "loading") {
    statusEl.textContent = "";
  }
  // Always reset to main view when switching top-level views
  if (view === "logged-in") {
    viewMain.classList.remove("hidden");
    viewSettings.classList.add("hidden");
  }
}

function showError(message: string) {
  loggedOutEl.classList.remove("hidden");
  loggedInEl.classList.add("hidden");
  statusEl.classList.remove("hidden");
  statusEl.textContent = message;
  statusEl.classList.add("text-red-400");
}

// ─── Settings panel toggle ──────────────────────────────────────────────────

btnSettings.addEventListener("click", async () => {
  viewMain.classList.add("hidden");
  viewSettings.classList.remove("hidden");
  await loadSettings();
});

btnBack.addEventListener("click", () => {
  viewSettings.classList.add("hidden");
  viewMain.classList.remove("hidden");
});

// ─── Load status ────────────────────────────────────────────────────────────

async function loadStatus() {
  showView("loading");

  const res = (await browser.runtime.sendMessage({
    action: "getStatus",
  })) as { loggedIn: boolean; email: string | null; spreadsheetId: string | null };

  if (res.loggedIn) {
    emailEl.textContent = res.email || "Signed in";
    if (res.spreadsheetId && /^[a-zA-Z0-9_-]+$/.test(res.spreadsheetId)) {
      linkSheetEl.href = `https://docs.google.com/spreadsheets/d/${res.spreadsheetId}`;
    }
    showView("logged-in");

    // Check if the current page is already saved and show appropriate actions
    await checkPageStatus();
  } else {
    showView("logged-out");
  }
}

// ─── Page status check (saved-page actions) ────────────────────────────────

async function checkPageStatus() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      btnSave.classList.remove("hidden");
      return;
    }
    currentPageUrl = tab.url;

    const res = (await browser.runtime.sendMessage({
      action: "getPageStatus",
      url: tab.url,
    })) as { found: boolean; status?: string };

    if (!res.found) {
      // Not saved yet — show the save button
      btnSave.classList.remove("hidden");
      return;
    }

    // Page is saved — show status-appropriate actions
    const status = res.status ?? "Todo";
    if (status === "Done") {
      doneBadgeEl.classList.remove("hidden");
    } else if (status === "In progress") {
      savedActionsEl.classList.remove("hidden");
      btnViewing.classList.add("hidden");
    } else {
      // "Todo" — show both buttons
      savedActionsEl.classList.remove("hidden");
    }
  } catch {
    // API error — fall back to showing save button
    btnSave.classList.remove("hidden");
  }
}

btnViewing.addEventListener("click", async () => {
  if (!currentPageUrl) return;
  btnViewing.textContent = "Updating…";
  btnViewing.setAttribute("disabled", "true");
  try {
    await browser.runtime.sendMessage({
      action: "updateStatus",
      url: currentPageUrl,
      status: "In progress",
    });
    btnViewing.classList.add("hidden");
  } catch {
    btnViewing.textContent = "Error";
    setTimeout(() => {
      btnViewing.textContent = "Viewing";
      btnViewing.removeAttribute("disabled");
    }, 1500);
  }
});

btnMarkDone.addEventListener("click", async () => {
  if (!currentPageUrl) return;
  btnMarkDone.textContent = "Updating…";
  btnMarkDone.setAttribute("disabled", "true");
  try {
    await browser.runtime.sendMessage({
      action: "updateStatus",
      url: currentPageUrl,
      status: "Done",
    });
    savedActionsEl.classList.add("hidden");
    doneBadgeEl.classList.remove("hidden");
  } catch {
    btnMarkDone.textContent = "Error";
    setTimeout(() => {
      btnMarkDone.textContent = "Done";
      btnMarkDone.removeAttribute("disabled");
    }, 1500);
  }
});

// ─── Login ──────────────────────────────────────────────────────────────────

btnLogin.addEventListener("click", async () => {
  showView("loading");
  statusEl.textContent = "Signing in…";
  try {
    const res = await browser.runtime.sendMessage({ action: "login" });
    console.log("Login response:", JSON.stringify(res));

    if (!res) {
      showError("Error: No response from background (res is undefined/null)");
      return;
    }

    if (res.success) {
      await loadStatus();
    } else {
      showError(`Error: ${res.error ?? "Login failed (no error detail)"}`);
    }
  } catch (err) {
    console.error("Login catch:", err);
    showError(`Catch: ${String(err)}`);
  }
});

// ─── Save ───────────────────────────────────────────────────────────────────

btnSave.addEventListener("click", async () => {
  btnSave.textContent = "Saving…";
  btnSave.setAttribute("disabled", "true");
  try {
    await browser.runtime.sendMessage({ action: "save" });
    btnSave.textContent = "Saved ✓";
    setTimeout(() => {
      // Transition to saved-page actions (status is "Todo" after a fresh save)
      btnSave.classList.add("hidden");
      btnSave.textContent = "Save Current Page";
      btnSave.removeAttribute("disabled");
      savedActionsEl.classList.remove("hidden");
    }, 1000);
  } catch {
    btnSave.textContent = "Error";
    setTimeout(() => {
      btnSave.textContent = "Save Current Page";
      btnSave.removeAttribute("disabled");
    }, 1500);
  }
});

// ─── Logout ─────────────────────────────────────────────────────────────────

btnLogout.addEventListener("click", async () => {
  await browser.runtime.sendMessage({ action: "logout" });
  showView("logged-out");
});

// ─── Settings logic ─────────────────────────────────────────────────────────

async function loadSettings() {
  const data = (await browser.storage.local.get([
    "sheetName",
    "smartCategorization",
  ])) as StorageSchema;

  sheetNameInput.value = data.sheetName ?? "Default";
  toggleSmart.checked = data.smartCategorization !== false;

  // Populate sheet name dropdown from cache (no API call)
  await populateSheetList(false);
}

/** Populate the sheet datalist. If forceRefresh=true, fetches from API. */
async function populateSheetList(forceRefresh: boolean) {
  try {
    const res = (await browser.runtime.sendMessage({
      action: "getSheets",
      forceRefresh,
    })) as { sheets: string[] };
    sheetList.innerHTML = "";
    for (const name of res.sheets) {
      const option = document.createElement("option");
      option.value = name;
      sheetList.appendChild(option);
    }
  } catch {
    // Not logged in or API error — leave dropdown empty
  }
}

btnSaveSheet.addEventListener("click", async () => {
  const name = sheetNameInput.value.trim();
  if (!name) {
    sheetStatus.textContent = "Name cannot be empty.";
    return;
  }

  sheetStatus.textContent = "Saving…";
  try {
    await browser.runtime.sendMessage({
      action: "ensureSheet",
      sheetName: name,
    });
    sheetStatus.textContent = `Sheet "${name}" is ready.`;
    // Refresh sheet list cache since a new sheet may have been created
    await populateSheetList(true);
  } catch (err) {
    sheetStatus.textContent = `Error: ${(err as Error).message}`;
  }

  setTimeout(() => {
    sheetStatus.textContent = "";
  }, 3000);
});

toggleSmart.addEventListener("change", async () => {
  await browser.storage.local.set({
    smartCategorization: toggleSmart.checked,
  } satisfies Partial<StorageSchema>);
});

btnClearCache.addEventListener("click", async () => {
  cacheStatus.textContent = "Clearing…";
  try {
    await browser.runtime.sendMessage({ action: "clearCache" });
    cacheStatus.textContent = "Cache cleared.";
  } catch (err) {
    cacheStatus.textContent = `Error: ${(err as Error).message}`;
  }

  setTimeout(() => {
    cacheStatus.textContent = "";
  }, 3000);
});
btnSyncSheets.addEventListener("click", async () => {
  btnSyncSheets.classList.add("animate-spin");
  try {
    await populateSheetList(true);
  } finally {
    btnSyncSheets.classList.remove("animate-spin");
  }
});

// ─── Sync Cache button (main view) ─────────────────────────────────────────

btnSync.addEventListener("click", async () => {
  btnSync.setAttribute("disabled", "true");
  btnSync.classList.add("opacity-60");
  syncIcon.classList.add("animate-spin");
  syncText.textContent = "Syncing…";
  try {
    const res = (await browser.runtime.sendMessage({ action: "syncCache" })) as {
      success: boolean;
      error?: string;
    };
    if (res.success) {
      syncText.textContent = "Synced ✓";
      // Re-check page status since cache may have changed
      btnSave.classList.add("hidden");
      savedActionsEl.classList.add("hidden");
      doneBadgeEl.classList.add("hidden");
      btnViewing.classList.remove("hidden");
      btnViewing.textContent = "Viewing";
      btnViewing.removeAttribute("disabled");
      btnMarkDone.textContent = "Done";
      btnMarkDone.removeAttribute("disabled");
      await checkPageStatus();
    } else {
      syncText.textContent = "Error";
    }
  } catch {
    syncText.textContent = "Error";
  } finally {
    syncIcon.classList.remove("animate-spin");
    btnSync.classList.remove("opacity-60");
    btnSync.removeAttribute("disabled");
    setTimeout(() => {
      syncText.textContent = "Sync";
    }, 2000);
  }
});
// ─── Init ───────────────────────────────────────────────────────────────────

loadStatus();
