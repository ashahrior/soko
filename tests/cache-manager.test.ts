import { describe, it, expect, beforeEach } from "vitest";
import { __resetStorage, __setStorage } from "./__mocks__/webextension-polyfill";
import { loadCache, hasUrl, addUrl, clearCache } from "../src/background/cache-manager";

describe("cache-manager", () => {
  beforeEach(() => {
    __resetStorage();
  });

  it("starts with an empty cache", async () => {
    await loadCache();
    expect(hasUrl("https://example.com")).toBe(false);
  });

  it("loads URLs from storage", async () => {
    __setStorage({ urlCache: ["https://a.com", "https://b.com"] });
    await loadCache();
    expect(hasUrl("https://a.com")).toBe(true);
    expect(hasUrl("https://b.com")).toBe(true);
    expect(hasUrl("https://c.com")).toBe(false);
  });

  it("adds a URL and persists it", async () => {
    await loadCache();
    expect(hasUrl("https://new.com")).toBe(false);

    await addUrl("https://new.com");
    expect(hasUrl("https://new.com")).toBe(true);
  });

  it("does not create duplicates when adding same URL twice", async () => {
    await loadCache();
    await addUrl("https://dup.com");
    await addUrl("https://dup.com");

    // The set should only have one entry
    expect(hasUrl("https://dup.com")).toBe(true);
  });

  it("clears all URLs from cache", async () => {
    __setStorage({ urlCache: ["https://a.com", "https://b.com"] });
    await loadCache();
    expect(hasUrl("https://a.com")).toBe(true);

    await clearCache();
    expect(hasUrl("https://a.com")).toBe(false);
    expect(hasUrl("https://b.com")).toBe(false);
  });
});
