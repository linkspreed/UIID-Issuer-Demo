# UIID Issuer Demo

A small, dependency-free demo app for the **UIID Issuer SDK**. It lets you act as a UIID Issuer: check your Issuer ID and counters, and issue UIID Core IDs that are permanently anchored to your Issuer ID.

![Screenshot of the UIID Issuer Demo](docs/screenshot.png)

> This is a community demo, not an official LINKSPREED product. The issuer data in the screenshot is example data.

## What it does

- Shows your **Issuer ID** and the counters returned by `GET /api/v1/issuer`.
- Issues a new **UIID Core ID** with `POST /api/v1/issuer/uiids` (the SDK's `createUiid()`).
- Lets you optionally set your own Core ID, or fetch one from the public `GET /api/v1/core/uiid/generate` utility.
- Asks for confirmation before issuing, because issued UIIDs are anchored to your Issuer ID permanently.
- Shows the raw JSON of the last request, so you can see exactly what the API returns.
- Light, dark and system theme.

## How it works

```
Browser (public/)  ──>  Demo server (server.js)  ──>  UIID Issuer SDK  ──>  UIID API
                         holds your API key              (or REST fallback)
```

Your API key never reaches the browser. The page talks only to the local demo server, and the server calls UIID with `Authorization: Bearer <API_KEY>`.

The server uses the **official UIID Issuer SDK** when it is present in `vendor/`. The SDK is not committed to this repository; you download it once with `npm run sdk:fetch`, so you always run the version published by the provider. Until then, a small built-in REST client with the same method names (`getIssuer`, `createUiid`) is used.

## Requirements

- Node.js 18.17 or newer (no `npm install` needed, there are no dependencies)
- A UIID **Company, Collective or Government** account with the Issuer program activated
- An API key of that Issuer account

## Quick start

```bash
git clone https://github.com/<your-account>/uiid-issuer-demo.git
cd uiid-issuer-demo

cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# open .env and set UIID_ISSUER_KEY

npm run sdk:fetch           # download the official SDK into vendor/
npm run check               # verify key and connection (issues nothing)
npm start                   # open http://127.0.0.1:3000
```

## Configuration

All settings live in `.env` (see `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `UIID_ISSUER_KEY` | — | API key of your Issuer account. Required. |
| `UIID_BASE_URL` | `https://uiid.linkspreed.com` | UIID provider. Change only for your own instance. |
| `UIID_CLIENT` | `auto` | `auto`: SDK if downloaded, else REST. `sdk`: SDK only. `rest`: REST only. |
| `HOST` | `127.0.0.1` | Address the demo server listens on. |
| `PORT` | `3000` | Port of the demo server. |

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Starts the demo server. |
| `npm run check` | Checks Node version, config and calls `GET /api/v1/issuer`. Does not issue anything. |
| `npm run sdk:fetch` | Downloads `/js/uiid-issuer-sdk.js` from `UIID_BASE_URL` into `vendor/` and prints its SHA-256. |

## Security notes

- **Issued UIIDs are permanent.** An anchored UIID can't be re-attributed to another issuer. Test with care.
- **Keep the server local.** It listens on `127.0.0.1` by default. Anyone who can reach it can issue UIIDs under your Issuer ID. Do not expose it to the internet without adding your own authentication.
- **Never commit `.env`.** It is in `.gitignore`. If a key was ever pushed, rotate it in the UIID dashboard.
- The server rejects issue requests from other websites (Origin check plus JSON-only requests), sets a strict Content Security Policy, and limits request bodies to 4 KB.
- The Issuer program stores only the Core ID and the Issuer ID. This demo stores nothing: the "Issued this session" list lives only in the browser tab.

## Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| `401 unauthorized` | API key missing or wrong | Check `UIID_ISSUER_KEY`, then restart. |
| `403 issuer_not_activated` | Issuer program not activated | Activate it in the Issuer panel of the UIID dashboard sidebar. |
| `400 invalid_identifiers` | Core ID missing or longer than 64 characters | Leave the Core ID field empty or press **Generate**. |
| `network_error` | UIID not reachable | Check `UIID_BASE_URL`, your connection and proxy. |

**Behind a company proxy:** Node's built-in `fetch` ignores `HTTPS_PROXY` by default. On recent Node.js versions you can turn proxy support on with `NODE_USE_ENV_PROXY=1`:

```powershell
# Windows PowerShell
$env:HTTPS_PROXY = "http://proxy.example.com:8080"
$env:NODE_USE_ENV_PROXY = "1"
npm run check
```

If your proxy inspects TLS, also point `NODE_EXTRA_CA_CERTS` to your company root certificate.

## Project structure

```
├── server.js              # Local HTTP server: static files + small JSON API
├── lib/
│   ├── config.js          # .env loader and settings
│   ├── issuer-client.js   # Loads the official SDK, falls back to REST
│   ├── rest-issuer.js     # Minimal REST client with the SDK's method names
│   └── errors.js          # Turns API errors into readable messages
├── scripts/
│   ├── fetch-sdk.js       # npm run sdk:fetch
│   └── check.js           # npm run check
├── public/                # The UI (HTML, CSS, vanilla JS — "Soft Brutalism")
└── vendor/                # Official SDK goes here (not committed)
```

## Notes and assumptions

- The SDK guide documents `new UiidIssuer({ apiKey })`, `getIssuer()` and `createUiid()` without arguments. This demo calls exactly that when the Core ID field is empty.
- When you enter a Core ID, the demo sends it as `{ "uiid_core_id": "..." }`, the field name used in the documented response. If your provider expects a different field name, adjust the call in `server.js` (`POST /api/uiids`).
- `baseUrl` is passed to the SDK constructor as a hint for self-hosted instances. The SDK may ignore it.

## License

[MIT](LICENSE)
