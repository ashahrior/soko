import { describe, it, expect } from "vitest";
import type {
  ExtensionMessage,
  SpreadsheetRow,
  StorageSchema,
} from "../src/shared/types";

describe("shared types", () => {
  it("ExtensionMessage can represent all action types", () => {
    const messages: ExtensionMessage[] = [
      { action: "save" },
      { action: "save", note: "A note" },
      { action: "showToast", message: "Hello" },
      { action: "login" },
      { action: "logout" },
      { action: "getStatus" },
      { action: "clearCache" },
      { action: "ensureSheet", sheetName: "Custom" },
    ];
    expect(messages).toHaveLength(8);
    expect(messages[0].action).toBe("save");
  });

  it("SpreadsheetRow has all required fields", () => {
    const row: SpreadsheetRow = {
      date: "2026-03-14 10:30",
      title: "Test Page",
      link: "https://example.com",
      type: "Webpage",
      notes: "",
      status: "Todo",
    };
    expect(row.date).toBe("2026-03-14 10:30");
    expect(row.status).toBe("Todo");
  });

  it("StorageSchema allows all optional fields", () => {
    const full: StorageSchema = {
      accessToken: "token",
      userEmail: "user@example.com",
      spreadsheetId: "abc123",
      sheetName: "Default",
      smartCategorization: true,
      urlCache: ["https://a.com"],
    };
    expect(full.userEmail).toBe("user@example.com");

    const empty: StorageSchema = {};
    expect(empty.accessToken).toBeUndefined();
  });
});
