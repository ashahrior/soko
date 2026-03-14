import browser from "webextension-polyfill";
import type { StorageSchema } from "../shared/types";

const GOOGLE_TOKEN_REVOKE_URL = "https://accounts.google.com/o/oauth2/revoke";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
// tokeninfo doesn't require extra scopes — works with any valid token
const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

/** Safety margin: treat token as expired 5 minutes before actual expiry. */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Detect whether we are running in Chrome (has chrome.identity.getAuthToken)
 * or Firefox (must use launchWebAuthFlow).
 */
export function isChrome(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.identity !== "undefined" &&
    typeof chrome.identity.getAuthToken === "function"
  );
}

/** Check whether the stored token is still valid (not expired). */
export async function isTokenValid(): Promise<boolean> {
  const data = (await browser.storage.local.get([
    "accessToken",
    "tokenExpiresAt",
  ])) as StorageSchema;
  if (!data.accessToken) return false;
  if (!data.tokenExpiresAt) return true; // legacy — no expiry stored, assume valid
  return Date.now() < data.tokenExpiresAt - EXPIRY_BUFFER_MS;
}

/**
 * Obtain an OAuth2 access token.
 * @param interactive Whether to show a login prompt if needed
 */
export async function getToken(interactive = true): Promise<string> {
  if (isChrome()) {
    return getChromeToken(interactive);
  }
  return getFirefoxToken(interactive);
}

async function getChromeToken(interactive: boolean): Promise<string> {
  const result = await chrome.identity.getAuthToken({ interactive });
  const token = typeof result === "string" ? result : result.token;
  if (!token) throw new Error("No token received");
  return token;
}

async function getFirefoxToken(interactive: boolean): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const redirectUrl = browser.identity.getRedirectURL();
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUrl);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("scope", SCOPES);
  // prompt=consent ensures scopes are always re-granted on re-auth
  if (interactive) {
    authUrl.searchParams.set("prompt", "consent");
  }

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive,
  });

  const hash = new URL(responseUrl).hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  if (!token) throw new Error("Failed to extract token from redirect");

  // Parse expiry from the implicit flow response (typically 3600 seconds)
  const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10);
  const tokenExpiresAt = Date.now() + expiresIn * 1000;
  await browser.storage.local.set({ tokenExpiresAt } satisfies Partial<StorageSchema>);

  return token;
}

/**
 * Obtain a valid token, refreshing silently if expired.
 * Falls back to interactive login only if silent refresh fails.
 */
export async function getValidToken(): Promise<string> {
  const valid = await isTokenValid();
  if (valid) {
    const data = (await browser.storage.local.get("accessToken")) as StorageSchema;
    if (data.accessToken) return data.accessToken;
  }

  // Clear stale Chrome cached token before attempting silent refresh
  if (isChrome()) {
    const data = (await browser.storage.local.get("accessToken")) as StorageSchema;
    if (data.accessToken) {
      chrome.identity.removeCachedAuthToken({ token: data.accessToken }, () => {});
    }
  }

  // Try non-interactive refresh first (Chrome can do this silently)
  try {
    const token = await getToken(/* interactive */ false);
    await persistToken(token);
    return token;
  } catch {
    // Silent refresh failed — need user interaction
    throw new Error("Session expired. Please sign in again.");
  }
}

/** Persist token to storage. */
async function persistToken(token: string): Promise<void> {
  // For Chrome tokens: getAuthToken manages expiry internally,
  // but we still track it for our own isTokenValid() check.
  // Chrome tokens typically last 1 hour.
  const data = (await browser.storage.local.get("tokenExpiresAt")) as StorageSchema;
  if (!data.tokenExpiresAt) {
    // Default to 1 hour if no expiry was set (e.g. Chrome path)
    await browser.storage.local.set({
      accessToken: token,
      tokenExpiresAt: Date.now() + 3600 * 1000,
    } satisfies Partial<StorageSchema>);
  } else {
    await browser.storage.local.set({
      accessToken: token,
    } satisfies Partial<StorageSchema>);
  }
}

/** Persist token & user email after login. */
export async function login(): Promise<{ email: string; token: string }> {
  // For Chrome: always clear any cached token first to force a fresh one.
  // This prevents Chrome from returning a stale/revoked token.
  if (isChrome()) {
    const stored = (await browser.storage.local.get("accessToken")) as StorageSchema;
    if (stored.accessToken) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: stored.accessToken! }, () => resolve());
      });
    }
  }

  let token = await getToken(/* interactive */ true);

  // For Chrome: set a default expiry since getAuthToken doesn't provide one
  if (isChrome()) {
    await browser.storage.local.set({
      accessToken: token,
      tokenExpiresAt: Date.now() + 3600 * 1000,
    } satisfies Partial<StorageSchema>);
  } else {
    // Firefox path already stored tokenExpiresAt in getFirefoxToken()
    await browser.storage.local.set({
      accessToken: token,
    } satisfies Partial<StorageSchema>);
  }

  // Fetch user email via tokeninfo (no extra scope needed)
  let email = "";
  try {
    const res = await fetch(`${GOOGLE_TOKENINFO_URL}?access_token=${token}`);
    if (res.ok) {
      const info = (await res.json()) as { email?: string };
      email = info.email ?? "";
    } else {
      console.warn("Could not fetch token info:", res.status);
    }
  } catch (err) {
    console.warn("Token info request failed:", err);
  }

  await browser.storage.local.set({
    userEmail: email,
  } satisfies Partial<StorageSchema>);

  return { email, token };
}

/** Revoke token & clear all auth/session storage. */
export async function logout(): Promise<void> {
  const data = (await browser.storage.local.get("accessToken")) as StorageSchema;
  if (data.accessToken) {
    // Best-effort revoke
    await fetch(`${GOOGLE_TOKEN_REVOKE_URL}?token=${data.accessToken}`, {
      method: "POST",
    }).catch(() => {});

    // Chrome-specific: also remove cached token
    if (isChrome()) {
      chrome.identity.removeCachedAuthToken({ token: data.accessToken }, () => {});
    }
  }
  await browser.storage.local.remove([
    "accessToken",
    "tokenExpiresAt",
    "userEmail",
    "spreadsheetId",
    "urlCache",
    "sheetName",
    "smartCategorization",
  ]);
}

/**
 * Return Authorization headers for API calls.
 * Automatically refreshes the token if it has expired.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getValidToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * Execute a fetch request with automatic 401 retry.
 * On a 401 response, refreshes the token and retries once.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = await getAuthHeaders();
  const mergedInit: RequestInit = {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  };

  let res = await fetch(input, mergedInit);

  if (res.status === 401) {
    // Token was rejected — force refresh
    try {
      const newToken = await getToken(/* interactive */ false);
      await persistToken(newToken);
    } catch {
      throw new Error("Session expired. Please sign in again.");
    }

    // Retry with fresh token
    const freshHeaders = await getAuthHeaders();
    const retryInit: RequestInit = {
      ...init,
      headers: { ...freshHeaders, ...(init?.headers as Record<string, string>) },
    };
    res = await fetch(input, retryInit);
  }

  return res;
}
