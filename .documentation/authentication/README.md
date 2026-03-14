# Authentication

## Overview

Soko uses **OAuth 2.0 Implicit Flow** to authenticate with Google APIs. The implementation handles two distinct browser environments with completely different OAuth mechanisms.

## Browser-Specific Auth Paths

### Chrome

Uses `chrome.identity.getAuthToken()` — Chrome manages the OAuth flow, token caching, and refresh internally.

```
login(interactive=true)
  └── chrome.identity.getAuthToken({ interactive: true })
      └── Chrome shows consent screen (if needed)
      └── Returns access_token string
```

Key characteristics:
- Chrome stores tokens internally and can refresh them silently
- `getAuthToken({ interactive: false })` returns a cached/refreshed token without UI
- `removeCachedAuthToken()` is needed on logout to clear Chrome's internal cache
- Token expiry is **not** provided by the API — Soko defaults to 1-hour expiry tracking

### Firefox

Uses `browser.identity.launchWebAuthFlow()` — a generic OAuth flow via a browser popup.

```
login(interactive=true)
  └── browser.identity.launchWebAuthFlow({
        url: "https://accounts.google.com/o/oauth2/v2/auth?...",
        interactive: true
      })
      └── User sees Google consent screen in popup
      └── Redirect URL contains: #access_token=...&expires_in=3600
```

Key characteristics:
- Token and `expires_in` are parsed from the redirect URL hash fragment
- `prompt=consent` is appended for interactive flows to ensure scopes are always re-granted
- Silent refresh (`interactive: false`) is less reliable than Chrome's managed tokens
- No equivalent of `removeCachedAuthToken` — token revocation is done via HTTP POST

## Token Lifecycle

```
┌─────────┐      ┌──────────┐      ┌───────────┐      ┌─────────┐
│  Login   │─────▶│  Active   │─────▶│  Expiring  │─────▶│ Expired  │
│(getToken)│      │ (valid)   │      │ (<5min left)│      │(invalid) │
└─────────┘      └──────────┘      └───────────┘      └─────────┘
                       │                    │                  │
                       │              getValidToken()    getValidToken()
                       │              returns cached     tries silent refresh
                       │                                      │
                       │                            ┌─────────┴────────┐
                       │                            │ Refresh succeeds │
                       │                            │ → new token      │
                       │                            │ Refresh fails    │
                       │                            │ → throw error    │
                       │                            └──────────────────┘
                       ▼
              authenticatedFetch(url, init)
                ├── Adds Authorization header
                ├── Makes request
                ├── If 401 → silent refresh → retry once
                └── Returns response
```

## Storage Keys

| Key | Type | Description |
|---|---|---|
| `accessToken` | `string` | Current OAuth access token |
| `tokenExpiresAt` | `number` | Unix timestamp (ms) when token expires |
| `userEmail` | `string` | User's Google email address |

## Key Functions (in `auth.ts`)

### `isChrome()`
Runtime detection of Chrome vs. Firefox. Checks for the existence of `chrome.identity.getAuthToken`.

### `isTokenValid()`
Reads `accessToken` and `tokenExpiresAt` from storage. Returns `true` if token exists and hasn't expired (with a **5-minute safety buffer**). Legacy tokens without expiry tracking are assumed valid.

### `getValidToken()`
Returns a usable token. If the current token is expired, attempts a **non-interactive** (silent) refresh. If silent refresh fails, throws `"Session expired. Please sign in again."`.

### `authenticatedFetch(input, init)`
Drop-in `fetch()` replacement that:
1. Calls `getAuthHeaders()` to get a fresh `Authorization: Bearer ...` header
2. Makes the request
3. On **401 response**: refreshes token silently and retries **once**
4. Returns the response (caller handles non-401 errors)

All Google API calls in `sheets-api.ts` use this function.

### `login()`
Full interactive login:
1. `getToken(interactive=true)` — prompts user if needed
2. Store `accessToken` + `tokenExpiresAt` in storage
3. Fetch user info from `googleapis.com/oauth2/v2/userinfo`
4. Store `userEmail`
5. Return `{ email, token }`

### `logout()`
Complete session teardown:
1. POST to Google's token revoke endpoint (best-effort)
2. Chrome: `removeCachedAuthToken()` to clear Chrome's internal cache
3. Remove **all 7 storage keys**: `accessToken`, `tokenExpiresAt`, `userEmail`, `spreadsheetId`, `urlCache`, `sheetName`, `smartCategorization`

## Security Considerations

1. **Token scope minimization** — Only `spreadsheets` and `drive.file` scopes are requested. `drive.file` limits access to files the extension created.
2. **Token revocation on logout** — Actively revokes the token server-side, not just deleting locally.
3. **Expiry buffer** — 5-minute buffer prevents using tokens that are about to expire mid-request.
4. **No refresh tokens** — Implicit flow doesn't issue refresh tokens. Chrome's `getAuthToken` handles refresh internally; Firefox requires re-auth when tokens expire.
5. **No cookies or sessions** — The extension uses token-based auth exclusively. No cookies are set or read. Session state is maintained entirely in `chrome.storage.local`.
