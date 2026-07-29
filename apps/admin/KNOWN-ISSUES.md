# Known Issues

## 1. Symbol search returns "No symbols found" (market data not configured)

**Status:** ✅ RESOLVED — 2026-07-27. The missing AngelOne credentials were added
to `apps/admin/.env` (`ANGELONE_CLIENT_CODE`, `ANGELONE_MPIN`, `ANGELONE_TOTP_SECRET`,
`ANGELONE_CLIENT_PUBLIC_IP`). Restart the dev server for them to take effect.
**Found:** 2026-07-24
**Affects:** the symbol picker in the post composer (`$` and 📊 buttons), and any
Markets/LTP/chart feature that goes through AngelOne.

### Root cause (historical)
`GET /api/v1/market/search` calls `searchSymbol()` in `lib/angelone.ts`, which first
logs in to AngelOne. The login builds a TOTP from `process.env.ANGELONE_TOTP_SECRET`.
That variable was **not set**, so the secret was `undefined` and `base32Decode()`
threw `Cannot read properties of undefined (reading 'toUpperCase')`. The route caught
the error and returned `{ ok: false, error, data: [] }` with HTTP 200; the picker only
read `json.data`, so an empty list rendered as "No symbols found" and the real error
was invisible.

### Fix applied
1. All four AngelOne credentials are now present in `apps/admin/.env`.
2. `lib/angelone.ts` — `assertAngelOneConfig()` is **re-enabled** (called at the top
   of `login()`); if a credential ever goes missing again it throws a clear
   `missing env var(s): ...` message instead of the cryptic `toUpperCase` crash.
3. `components/social/symbol-search-picker.tsx` — error surfacing is **re-enabled**;
   when the API returns `{ ok: false, error }` the picker shows the real message in
   red instead of silently falling through to "No symbols found".

### If it still fails after restart
It is no longer a missing-key problem. Most likely causes:
- **Public IP mismatch** — `ANGELONE_CLIENT_PUBLIC_IP` must match the IP registered
  with the AngelOne app / current network.
- **TOTP / clock drift** — `login()` already retries adjacent time windows; verify
  `ANGELONE_TOTP_SECRET` is the base32 2FA secret (not a 6-digit code).

Reproduce directly:

```
curl "http://localhost:3001/api/v1/market/search?q=TCS&exchange=ALL"
```
