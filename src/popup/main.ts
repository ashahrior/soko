import browser from "webextension-polyfill";

const loggedOutEl = document.getElementById("logged-out")!;
const loggedInEl = document.getElementById("logged-in")!;
const statusEl = document.getElementById("status")!;
const emailEl = document.getElementById("user-email")!;
const linkSheetEl = document.getElementById("link-sheet") as HTMLAnchorElement;
const btnLogin = document.getElementById("btn-login")!;
const btnSave = document.getElementById("btn-save")!;
const btnLogout = document.getElementById("btn-logout")!;

function showView(view: "logged-out" | "logged-in" | "loading") {
  loggedOutEl.classList.toggle("hidden", view !== "logged-out");
  loggedInEl.classList.toggle("hidden", view !== "logged-in");
  statusEl.classList.toggle("hidden", view !== "loading");
}

async function loadStatus() {
  showView("loading");

  const res = (await browser.runtime.sendMessage({
    action: "getStatus",
  })) as { loggedIn: boolean; email: string | null; spreadsheetId: string | null };

  if (res.loggedIn && res.email) {
    emailEl.textContent = res.email;
    if (res.spreadsheetId && /^[a-zA-Z0-9_-]+$/.test(res.spreadsheetId)) {
      linkSheetEl.href = `https://docs.google.com/spreadsheets/d/${res.spreadsheetId}`;
    }
    showView("logged-in");
  } else {
    showView("logged-out");
  }
}

btnLogin.addEventListener("click", async () => {
  showView("loading");
  statusEl.textContent = "Signing in…";
  try {
    await browser.runtime.sendMessage({ action: "login" });
    await loadStatus();
  } catch (err) {
    statusEl.textContent = `Error: ${(err as Error).message}`;
  }
});

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

btnLogout.addEventListener("click", async () => {
  await browser.runtime.sendMessage({ action: "logout" });
  showView("logged-out");
});

loadStatus();
