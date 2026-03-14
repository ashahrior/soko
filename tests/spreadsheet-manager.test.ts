import { describe, it, expect, beforeEach, vi } from "vitest";
import { __resetStorage, __setStorage } from "./__mocks__/webextension-polyfill";

// Mock sheets-api before importing spreadsheet-manager
vi.mock("../src/background/sheets-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/background/sheets-api")>();
  return {
    ...actual,
    searchDriveFile: vi.fn(),
    createSpreadsheet: vi.fn(),
    getSheetNames: vi.fn(),
    addSheet: vi.fn(),
    updateRange: vi.fn(),
    formatHeaderRow: vi.fn(),
    setDataValidation: vi.fn(),
  };
});

import { initSpreadsheet, ensureSheet, getSheetName } from "../src/background/spreadsheet-manager";
import * as sheetsApi from "../src/background/sheets-api";

describe("spreadsheet-manager", () => {
  beforeEach(() => {
    __resetStorage();
    vi.clearAllMocks();
  });

  describe("getSheetName", () => {
    it("returns 'Default' when no sheet name is set", async () => {
      const name = await getSheetName();
      expect(name).toBe("Default");
    });

    it("returns stored sheet name", async () => {
      __setStorage({ sheetName: "Custom" });
      const name = await getSheetName();
      expect(name).toBe("Custom");
    });
  });

  describe("initSpreadsheet", () => {
    it("returns stored spreadsheetId if already saved", async () => {
      __setStorage({ spreadsheetId: "existing-id-123" });
      vi.mocked(sheetsApi.getSheetNames).mockResolvedValue([
        { title: "Default", sheetId: 0 },
      ]);

      const id = await initSpreadsheet();
      expect(id).toBe("existing-id-123");
      expect(sheetsApi.createSpreadsheet).not.toHaveBeenCalled();
    });

    it("searches Drive and stores id if spreadsheet found", async () => {
      vi.mocked(sheetsApi.searchDriveFile).mockResolvedValue({
        id: "found-id",
      });
      vi.mocked(sheetsApi.getSheetNames).mockResolvedValue([
        { title: "Default", sheetId: 0 },
      ]);

      const id = await initSpreadsheet();
      expect(id).toBe("found-id");
      expect(sheetsApi.searchDriveFile).toHaveBeenCalledWith("Soko");
    });

    it("creates a new spreadsheet if none found", async () => {
      vi.mocked(sheetsApi.searchDriveFile).mockResolvedValue(null);
      vi.mocked(sheetsApi.createSpreadsheet).mockResolvedValue({
        spreadsheetId: "new-id",
        sheetId: 0,
      });

      const id = await initSpreadsheet();
      expect(id).toBe("new-id");
      expect(sheetsApi.createSpreadsheet).toHaveBeenCalledWith("Soko", "Default");
      expect(sheetsApi.updateRange).toHaveBeenCalledWith(
        "new-id",
        "'Default'!A1:F1",
        [["Date", "Title", "Link", "Type", "Notes", "Status"]],
      );
      expect(sheetsApi.formatHeaderRow).toHaveBeenCalledWith("new-id", 0);
      expect(sheetsApi.setDataValidation).toHaveBeenCalledWith(
        "new-id",
        0,
        5,
        ["Todo", "In progress", "Done"],
      );
    });
  });

  describe("ensureSheet", () => {
    it("does nothing if sheet already exists", async () => {
      vi.mocked(sheetsApi.getSheetNames).mockResolvedValue([
        { title: "MySheet", sheetId: 1 },
      ]);

      await ensureSheet("ss-id", "MySheet");
      expect(sheetsApi.addSheet).not.toHaveBeenCalled();
    });

    it("creates sheet if not found", async () => {
      vi.mocked(sheetsApi.getSheetNames).mockResolvedValue([
        { title: "Default", sheetId: 0 },
      ]);
      vi.mocked(sheetsApi.addSheet).mockResolvedValue(42);

      await ensureSheet("ss-id", "NewSheet");
      expect(sheetsApi.addSheet).toHaveBeenCalledWith("ss-id", "NewSheet");
      expect(sheetsApi.updateRange).toHaveBeenCalledWith(
        "ss-id",
        "'NewSheet'!A1:F1",
        [["Date", "Title", "Link", "Type", "Notes", "Status"]],
      );
      expect(sheetsApi.formatHeaderRow).toHaveBeenCalledWith("ss-id", 42);
      expect(sheetsApi.setDataValidation).toHaveBeenCalledWith(
        "ss-id",
        42,
        5,
        ["Todo", "In progress", "Done"],
      );
    });
  });
});
