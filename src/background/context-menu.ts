import browser from "webextension-polyfill";

const MENU_ID = "knots-save-note";

/** Register the context menu item (call once on install). */
export function registerContextMenu(): void {
  browser.contextMenus.create({
    id: MENU_ID,
    title: "Knots: Save Note",
    contexts: ["selection"],
  });
}

/**
 * Attach the context-menu click handler.
 * @param onSaveNote Callback receiving (tab, selectionText).
 */
export function onContextMenuClick(
  onSaveNote: (
    tab: browser.Tabs.Tab,
    selectionText: string,
  ) => Promise<void>,
): void {
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && info.selectionText && tab) {
      onSaveNote(tab, info.selectionText);
    }
  });
}
