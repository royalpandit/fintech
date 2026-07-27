# Known Issues

## 1. Symbol search returns "No symbols found" (market data not configured)

**Status:** open — needs credentials, not a code fix.
**Found:** 2026-07-24
**Affects:** the symbol picker in the post composer (`$` and 📊 buttons), and any
Markets/LTP/chart feature that goes through AngelOne.

### Symptom
Typing any symbol (e.g. `TCS`, `RELIANCE`) in the composer's symbol picker shows
**"No symbols found"**, even for valid, well-known symbols.

### Root cause
`GET /api/v1/market/search` calls `searchSymbol()` in `lib/angelone.ts`, which
first logs in to AngelOne. The login builds a TOTP from
`process.env.ANGELONE_TOTP_SECRET`. That variable is **not set**, so the secret is
`undefined` and `base32Decode()` throws:

```
Cannot read properties of undefined (reading 'toUpperCase')
```

The route catches the error and returns `{ ok: false, error, data: [] }` with HTTP
200. The picker only reads `json.data`, so an empty list renders as
"No symbols found" — the real error is invisible in the UI.

Reproduce directly:

```
curl "http://localhost:3001/api/v1/market/search?q=TCS&exchange=ALL"
```

### Missing configuration
`apps/admin/.env` currently defines only:

| Env var                 | Present |
| ----------------------- | ------- |
| `ANGELONE_API_KEY`      | yes     |
| `ANGELONE_API_SECRET`   | yes     |
| `ANGELONE_CLIENT_CODE`  | **no**  |
| `ANGELONE_MPIN`         | **no**  |
| `ANGELONE_TOTP_SECRET`  | **no**  |

`lib/angelone.ts` requires `ANGELONE_API_KEY`, `ANGELONE_CLIENT_CODE`,
`ANGELONE_MPIN` and `ANGELONE_TOTP_SECRET` to log in.

### Fix
Add the three missing values to `apps/admin/.env` and restart the dev server:

```
ANGELONE_CLIENT_CODE=<angelone client code>
ANGELONE_MPIN=<4-digit mpin>
ANGELONE_TOTP_SECRET=<base32 secret from AngelOne 2FA setup>
```

`ANGELONE_TOTP_SECRET` is the base32 string issued when enabling 2FA (the value you
would scan into an authenticator app) — not a generated 6-digit code.

Note: this search **worked earlier in the same session**, so these variables were
present before and were later removed or overwritten.

### Diagnostic code (written, then commented out pending this report)
Both changes are left in place, commented, and can be re-enabled once the issue is
reported/accepted:

1. `lib/angelone.ts` — `assertAngelOneConfig()` plus its call at the top of
   `login()`. Throws a clear `missing env var(s): ...` message instead of the
   cryptic `toUpperCase` crash.
2. `components/social/symbol-search-picker.tsx` — an `error` state that reads
   `json.error` when `json.ok === false` and renders it in red, instead of
   silently falling through to "No symbols found".

With (1) enabled the endpoint returns:

```
{"ok":false,"error":"AngelOne is not configured — missing env var(s): ANGELONE_CLIENT_CODE, ANGELONE_MPIN, ANGELONE_TOTP_SECRET. Add them to apps/admin/.env and restart the dev server.","data":[]}
```
