/**
 * Mock for webextension-polyfill in test environment.
 * Provides minimal stubs of the browser.* APIs used by the extension.
 */

const storageData: Record<string, unknown> = {};

const browser = {
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[]) => {
        if (!keys) return { ...storageData };
        const keyArr = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of keyArr) {
          if (k in storageData) result[k] = storageData[k];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storageData, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) delete storageData[k];
      }),
    },
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  tabs: {
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    get: vi.fn(),
    query: vi.fn(async () => []),
    sendMessage: vi.fn(),
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  identity: {
    getAuthToken: vi.fn(),
    getRedirectURL: vi.fn(() => "https://redirect.example.com"),
    launchWebAuthFlow: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
};

/** Helper to reset storage state between tests */
export function __resetStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key];
  }
}

/** Helper to seed storage state for tests */
export function __setStorage(data: Record<string, unknown>) {
  Object.assign(storageData, data);
}

export default browser;
