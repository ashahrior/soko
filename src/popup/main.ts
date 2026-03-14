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

// ─── Settings elements ──────────────────────────────────────────────────────
const sheetNameInput = document.getElementById("sheet-name") as HTMLInputElement;
const btnSaveSheet = document.getElementById("btn-save-sheet")!;
const sheetStatus = document.getElementById("sheet-status")!;
const toggleSmart = document.getElementById("toggle-smart") as HTMLInputElement;
const btnClearCache = document.getElementById("btn-clear-cache")!;
const cacheStatus = document.getElementById("cache-status")!;

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
  } else {
    showView("logged-out");
  }
}

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
      btnSave.textContent = "Save Current Page";
      btnSave.removeAttribute("disabled");
    }, 1500);
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

// ─── Init ───────────────────────────────────────────────────────────────────

loadStatus();
