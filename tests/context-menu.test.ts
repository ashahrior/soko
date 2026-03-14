import { describe, it, expect, vi, beforeEach } from "vitest";
import browser from "./__mocks__/webextension-polyfill";
import { registerContextMenu, onContextMenuClick } from "../src/background/context-menu";

describe("context-menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a context menu item with correct properties", () => {
    registerContextMenu();
    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "soko-save-note",
      title: "Soko: Save Note",
      contexts: ["selection"],
    });
  });

  it("attaches a click listener", () => {
    const callback = vi.fn();
    onContextMenuClick(callback);
    expect(browser.contextMenus.onClicked.addListener).toHaveBeenCalled();
  });

  it("calls the callback with tab and selection text when menu item clicked", () => {
    const callback = vi.fn();
    onContextMenuClick(callback);

    // Get the actual listener that was passed to addListener
    const listener = vi.mocked(browser.contextMenus.onClicked.addListener).mock
      .calls[0][0] as (
      info: { menuItemId: string; selectionText?: string },
      tab?: { id: number; url: string },
    ) => void;

    const fakeTab = { id: 1, url: "https://example.com" };
    listener(
      { menuItemId: "soko-save-note", selectionText: "some text" },
      fakeTab as any,
    );

    expect(callback).toHaveBeenCalledWith(fakeTab, "some text");
  });

  it("does not call callback for other menu item ids", () => {
    const callback = vi.fn();
    onContextMenuClick(callback);

    const listener = vi.mocked(browser.contextMenus.onClicked.addListener).mock
      .calls[0][0] as (
      info: { menuItemId: string; selectionText?: string },
      tab?: { id: number },
    ) => void;

    listener({ menuItemId: "other-id", selectionText: "text" }, { id: 1 } as any);
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not call callback when no selection text", () => {
    const callback = vi.fn();
    onContextMenuClick(callback);

    const listener = vi.mocked(browser.contextMenus.onClicked.addListener).mock
      .calls[0][0] as (
      info: { menuItemId: string; selectionText?: string },
      tab?: { id: number },
    ) => void;

    listener({ menuItemId: "soko-save-note" }, { id: 1 } as any);
    expect(callback).not.toHaveBeenCalled();
  });
});
