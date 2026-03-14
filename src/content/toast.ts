import browser from "webextension-polyfill";

const TOAST_ID = "knots-toast";
const TOAST_DURATION = 2500;
const FADE_DURATION = 300;

function createToastElement(message: string): HTMLDivElement {
  // Remove existing toast
  const existing = document.getElementById(TOAST_ID);
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = TOAST_ID;
  el.textContent = message;

  Object.assign(el.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "12px 20px",
    borderRadius: "8px",
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: "500",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    opacity: "0",
    transition: `opacity ${FADE_DURATION}ms ease`,
    pointerEvents: "none" as const,
  } satisfies Partial<CSSStyleDeclaration>);

  return el;
}

function showToast(message: string): void {
  const el = createToastElement(message);
  document.body.appendChild(el);

  // Trigger fade-in
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });

  // Fade-out after duration
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), FADE_DURATION);
  }, TOAST_DURATION);
}

// Listen for messages from the background script
browser.runtime.onMessage.addListener(
  (msg: unknown) => {
    const message = msg as { action: string; message?: string };
    if (message.action === "showToast" && message.message) {
      showToast(message.message);
    }
  },
);
