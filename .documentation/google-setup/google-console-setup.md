# Google Cloud Console Setup

Complete guide for configuring Google Cloud to work with the Knots browser extension.

---

## Table of Contents

1. [Create a Google Cloud Project](#1-create-a-google-cloud-project)
2. [Enable Required APIs](#2-enable-required-apis)
3. [Configure the OAuth Consent Screen](#3-configure-the-oauth-consent-screen)
4. [Create OAuth Credentials](#4-create-oauth-credentials)
5. [Get Your Extension ID](#5-get-your-extension-id)
6. [Configure the Extension](#6-configure-the-extension)
7. [Client ID Security](#7-client-id-security)
8. [Production Publishing](#9-production-publishing)
9. [API Quotas](#10-api-quotas)
10. [Troubleshooting](#11-troubleshooting)

---

## 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the **project dropdown** at the top-left (next to "Google Cloud")
3. Click **New Project**
4. Enter:
   - **Project name:** `Knots` (or anything you prefer)
   - **Organization:** leave as default
5. Click **Create**
6. Wait a few seconds, then **select your new project** from the dropdown

## 2. Enable Required APIs

Both APIs must be enabled for the extension to function:

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for **Google Sheets API**
   - Click it → Click **Enable**
3. Go back to Library, search for **Google Drive API**
   - Click it → Click **Enable**

Verify both show as enabled under **APIs & Services → Enabled APIs & services**.

| API | Purpose in Knots |
|-----|----------------|
| Google Sheets API v4 | Create spreadsheets, append rows, read columns, set validation |
| Google Drive API v3 | Search for existing "Knots Sheets" spreadsheet in user's Drive |

## 3. Configure the OAuth Consent Screen

This **must** be configured before creating credentials.

1. Go to **APIs & Services → OAuth consent screen**
2. Click **Get started** (or **Configure consent screen**)
3. Choose **External** user type → Click **Create**
4. Fill in:
   - **App name:** `Knots`
   - **User support email:** your email
   - **Developer contact email:** your email
5. Click **Save and Continue**

### Adding Scopes

The Scopes screen location depends on your Console UI version:

**New UI (2025+):**
- In the left sidebar under "OAuth consent screen", click **Data Access**
- Click **Add or remove scopes**

**Legacy UI:**
- After saving App info, you arrive at **Step 2: Scopes** automatically
- Click **Add or remove scopes**

Add these two scopes:

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

> **Tip:** Use the filter/search box to find them quickly. Check both → Click **Update** → **Save and Continue**.

| Scope | Access Level | Why Knots Needs It |
|-------|-------------|-------------------|
| `spreadsheets` | Read/write all spreadsheets | Create "Knots Sheets" spreadsheet, append saved pages, read URLs for cache sync |
| `drive.file` | Only files the app created | Search for existing "Knots Sheets" spreadsheet (limited to app-created files) |

### Adding Test Users

On the **Test users** screen:
1. Click **Add users**
2. Add your own Google email address (and any testers)
3. Click **Save and Continue**

> **Important:** While the consent screen is in **Testing** status, only listed test users can authorize. Other users will see "Error 403: access_denied".

## 4. Create OAuth Credentials

### For Chrome

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Set:
   - **Application type:** `Chrome Extension`
   - **Name:** `Knots Chrome`
   - **Item ID:** your extension's ID (see [Step 5](#5-get-your-extension-id))
4. Click **Create**
5. Copy the **Client ID** — it looks like:
   ```
   567602922983-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
   ```

### For Firefox (optional, if targeting Firefox)

1. Still on **Credentials**, click **Create Credentials → OAuth client ID** again
2. Set:
   - **Application type:** `Web application`
   - **Name:** `Knots Firefox`
3. Under **Authorized redirect URIs**, click **Add URI**
4. Get your redirect URI by running this in the extension's background console:
   ```javascript
   browser.identity.getRedirectURL()
   ```
   It returns something like:
   ```
   https://abcdefghijklmnop.extensions.allizom.org/
   ```
5. Paste that URL as the redirect URI
6. Click **Create**
7. Copy the **Client ID**

> **Note:** You can use the same Client ID for both Chrome and Firefox if you create a Web Application type and add both redirect URIs. However, Chrome Extension type is recommended for Chrome because `chrome.identity.getAuthToken` reads `oauth2.client_id` directly from the manifest.

## 5. Get Your Extension ID

The extension ID is assigned by Chrome when you **load** the extension — it's not in the build output.

### Steps

1. Build the extension:
   ```bash
   npm run build:chrome
   ```

2. Open Chrome and go to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** → select the `dist-chrome/` folder

5. The extension appears as a card. The **ID** is the 32-character string below the name:
   ```
   ┌─────────────────────────────────────────────────┐
   │  Knots                                   1.0.0  │
   │  Save web resources to Google Sheets...         │
   │                                                 │
   │  ID: abcdefghijklmnopqrstuvwxyzabcdef  ← THIS   │
   │  Inspect views: service worker                  │
   └─────────────────────────────────────────────────┘
   ```

6. Copy that ID and paste it into your Google Cloud OAuth credential's **Item ID** field

### Pinning the Extension ID

By default, the extension ID **changes** every time you load unpacked from a different path. To pin it permanently, generate a key:

```bash
openssl genrsa 2048 | openssl rsa -pubout -outform DER | openssl base64 -A
```

Add the output to `src/manifest.json` (or the manifest function in `vite.config.ts`):

```json
"key": "MIIBIjANBgkqh...your-long-base64-string..."
```

After rebuilding and reloading, the extension ID will remain the same across reinstalls. This ID must match the **Item ID** in your Google Cloud OAuth credential.

## 6. Configure the Extension

### Environment File

1. Copy the example:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Client ID:
   ```properties
   VITE_GOOGLE_CLIENT_ID=567602922983-xxxxxxxx.apps.googleusercontent.com
   ```

3. Make sure `.env` is in `.gitignore`:
   ```
   .env
   .env.local
   .env.*.local
   ```

### How the Client ID is Used

| Context | Source | Mechanism |
|---------|--------|-----------|
| Chrome `getAuthToken` | `manifest.json` → `oauth2.client_id` | Chrome reads this automatically |
| Firefox `launchWebAuthFlow` | `import.meta.env.VITE_GOOGLE_CLIENT_ID` | Injected by Vite at build time |
| Build output manifest | Generated from `vite.config.ts` | Reads `.env` via `loadEnv()` |

### Build and Verify

```bash
npm run build:chrome

# Verify the client ID was injected:
grep client_id dist-chrome/manifest.json
```

## 7. Client ID Security

### Is the Client ID a Secret?

**No.** For Chrome Extension type OAuth credentials:

- The Client ID is embedded in every published Chrome extension (anyone can extract it from the `.crx` file)
- It's **locked to your extension ID** by Google — no other extension or app can use it
- Google's own documentation confirms it is **not a secret** for this credential type

### Why Still Keep It Out of Git?

- **Best practice** — separation of config from code
- **Prevents accidents** — if you ever add truly secret values (like a `client_secret` for server-side flows), the habit of gitignoring `.env` protects you
- **Multiple environments** — different developers/CI can use different Client IDs without code changes


## 8. Production Publishing

### Chrome Web Store

1. Build:
   ```bash
   npm run build:chrome
   ```

2. Zip the output:
   ```bash
   cd dist-chrome && zip -r ../knots-chrome.zip . && cd ..
   ```

3. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

4. Note the **stable extension ID** assigned by the store

5. Update your OAuth credential:
   - Go to **Google Cloud Console → APIs & Services → Credentials**
   - Edit your Chrome Extension OAuth client
   - Update the **Item ID** to the store-assigned ID

6. Set OAuth consent screen status to **In production**
   - This triggers Google's verification process for the `spreadsheets` and `drive.file` scopes

7. Rebuild with the final client ID and upload the updated zip

### How Published Extensions Work for Users

When users install from the Chrome Web Store:

```
User installs from store
  → Clicks "Sign in with Google"
  → Chrome shows Google's OAuth consent screen
  → User authorizes
  → Extension gets a token
  → Everything works — zero configuration for the user
```

The Client ID is baked into the extension at build time. Users never see it, never need to provide it, and never need their own Google Cloud project.

## 9. API Quotas

All users share your Google Cloud project's API quota:

| API | Free Quota |
|-----|-----------|
| Google Sheets API | 300 requests/min per project |
| Google Drive API | 20,000 requests/day per project |

Each "Save" action uses **1 Sheets API call** (`appendRow`). Cache sync uses **1 call** (`readColumn`). For most use cases, the free tier is more than sufficient.

If you scale beyond hobby usage, request a quota increase in **Google Cloud Console → APIs & Services → Quotas**.

## 10. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `OAuth2 not granted or revoked` | Extension ID doesn't match the OAuth credential | Verify the ID at `chrome://extensions` matches the **Item ID** in Google Cloud |
| `Access blocked: This app's request is invalid` | Consent screen not configured or scopes missing | Complete [Step 3](#3-configure-the-oauth-consent-screen) fully |
| `Error 403: access_denied` | Your email isn't in the test users list | Add your email in OAuth consent screen → Test users |
| `Error 403: Google Sheets API has not been enabled` | API not enabled | Enable it in [Step 2](#2-enable-required-apis) |
| `redirect_uri_mismatch` (Firefox) | Redirect URI doesn't match | Run `browser.identity.getRedirectURL()` and add the exact output to your OAuth credential |
| `client_id` is `undefined` in built manifest | `.env` file missing or incorrectly named | Check that `.env` exists at the project root with `VITE_GOOGLE_CLIENT_ID=...` |
| Extension ID changed after reinstall | No `key` in manifest | Add a `key` field — see [Step 5](#5-get-your-extension-id) |
