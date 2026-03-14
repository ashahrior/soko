import browser from "webextension-polyfill";
import type { StorageSchema } from "../shared/types";

const sheetNameInput = document.getElementById("sheet-name") as HTMLInputElement;
const btnSaveSheet = document.getElementById("btn-save-sheet")!;
const sheetStatus = document.getElementById("sheet-status")!;

const toggleSmart = document.getElementById("toggle-smart") as HTMLInputElement;

const btnClearCache = document.getElementById("btn-clear-cache")!;
const cacheStatus = document.getElementById("cache-status")!;

// ─── Load current settings ──────────────────────────────────────────────────

async function loadSettings() {
  const data = (await browser.storage.local.get([
    "sheetName",
    "smartCategorization",
  ])) as StorageSchema;

  sheetNameInput.value = data.sheetName ?? "Default";
  toggleSmart.checked = data.smartCategorization !== false;
}

// ─── Sheet Name ─────────────────────────────────────────────────────────────

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

// ─── Smart Categorization Toggle ────────────────────────────────────────────

toggleSmart.addEventListener("change", async () => {
  await browser.storage.local.set({
    smartCategorization: toggleSmart.checked,
  } satisfies Partial<StorageSchema>);
});

// ─── Clear Cache ────────────────────────────────────────────────────────────

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

loadSettings();
