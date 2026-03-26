# Testing

## Overview

Tests use **Vitest** with a custom mock for `webextension-polyfill`. The test suite currently has **37 tests** across 5 test files.

## Configuration

**File:** `vitest.config.ts`

```typescript
{
  test: {
    globals: true,        // vi, describe, it, expect available globally
    environment: "node",  // No jsdom needed (background scripts are not DOM-dependent)
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "webextension-polyfill": "./tests/__mocks__/webextension-polyfill.ts",
    },
  },
}
```

The key detail is the **alias** — all `import browser from "webextension-polyfill"` statements in source code resolve to the mock during tests.

## Browser API Mock

**File:** `tests/__mocks__/webextension-polyfill.ts`

A minimal mock that stubs every `browser.*` API used by the extension:

| API | Mock Behavior |
|---|---|
| `browser.storage.local` | **Functional** — backed by an in-memory `Record<string, unknown>` |
| `browser.runtime.*` | `vi.fn()` stubs (listeners, sendMessage) |
| `browser.tabs.*` | `vi.fn()` stubs |
| `browser.action.*` | `vi.fn()` stubs (badge) |
| `browser.identity.*` | `vi.fn()` stubs (getAuthToken, launchWebAuthFlow) |
| `browser.contextMenus.*` | `vi.fn()` stubs |

### Storage Simulation

The mock's `storage.local` is **fully functional** with `get`, `set`, and `remove` operations backed by a shared in-memory object. This allows tests to verify real storage interactions.

### Test Helpers

```typescript
import { __resetStorage, __setStorage } from "./__mocks__/webextension-polyfill";

// Reset all storage between tests
beforeEach(() => __resetStorage());

// Pre-seed storage for a specific test
__setStorage({ spreadsheetId: "abc123", sheetName: "Default" });
```

## Test Files

### `tests/categorizer.test.ts` (15 tests)

Tests the pure `categorize()` function and the `DOMAIN_CATEGORY_MAP` lookup table. No mocking needed — verifies domain-to-category mapping across all supported categories.

```
✓ YouTube → Video
✓ GitHub → Code
✓ dev.to → Article
✓ Unknown domains → General
✓ Returns "General" when disabled
```

### `tests/cache-manager.test.ts` (5 tests)

Tests the URL cache lifecycle. Uses `__setStorage` / `__resetStorage` for state setup. Mocks `sheets-api.readColumn` for `syncCache()` tests.

```
✓ loadCache() populates from storage
✓ hasUrl() returns correct results
✓ addUrl() persists to storage
✓ clearCache() empties everything
✓ syncCache() rebuilds from spreadsheet
```

### `tests/spreadsheet-manager.test.ts` (9 tests)

Tests spreadsheet initialization and sheet creation. Uses `vi.mock("../src/background/sheets-api")` with the `importOriginal` pattern:

```typescript
vi.mock("../src/background/sheets-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/background/sheets-api")>();
  return {
    ...real,                    // Keep escapeSheetName() as-is
    searchDriveFile: vi.fn(),   // Mock API calls
    createSpreadsheet: vi.fn(),
    // ...
  };
});
```

This pattern preserves pure utility functions (`escapeSheetName`) while mocking API calls.

### `tests/context-menu.test.ts` (5 tests)

Tests context menu registration and click handling.

### `tests/types.test.ts` (3 tests)

Compile-time type safety checks using `expectTypeOf()`.

## Running Tests

```bash
npm test              # Single run
npm run test:watch    # Watch mode (re-runs on file change)
```

## Adding New Tests

1. Create `tests/your-module.test.ts`
2. Import the module under test
3. Use `__resetStorage()` in `beforeEach` if the module touches storage
4. Mock external dependencies with `vi.mock()`
5. If you need to preserve some real exports from a mocked module, use the `importOriginal` pattern shown above

### Example Template

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { __resetStorage, __setStorage } from "./__mocks__/webextension-polyfill";
import { myFunction } from "../src/background/my-module";

// Mock dependencies
vi.mock("../src/background/sheets-api", () => ({
  someApiCall: vi.fn().mockResolvedValue({ data: "mocked" }),
}));

describe("myFunction", () => {
  beforeEach(() => {
    __resetStorage();
    vi.clearAllMocks();
  });

  it("should do something", async () => {
    __setStorage({ spreadsheetId: "test-id" });
    const result = await myFunction();
    expect(result).toBe(expectedValue);
  });
});
```
