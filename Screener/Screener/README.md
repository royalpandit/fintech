# Screener — NSE Live Charts (Angel SmartAPI + Lightweight Charts)

Live NSE equity charts using [Angel One SmartAPI](https://smartapi.angelbroking.com/docs/Introduction) for market data and [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/) for candlesticks.

## Quick start

```bash
cp .env.example .env.local
# Edit .env.local with your Angel SmartAPI credentials
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Description |
|----------|-------------|
| `ANGELONE_API_KEY` | API key from SmartAPI app (`X-PrivateKey`) |
| `ANGELONE_CLIENT_CODE` | Angel client ID |
| `ANGELONE_MPIN` | Login PIN |
| `ANGELONE_TOTP_SECRET` | TOTP secret (base32, from authenticator setup) |

Credentials are **server-only** (Next.js API routes). Never expose MPIN/TOTP in client code.

## Architecture

```
Browser (Lightweight Charts)
    ↓ fetch /api/smartapi/*
Next.js API routes
    ↓ login + JWT
Angel SmartAPI (historical candles, LTP, symbol search)
```

- **Search**: `searchScrip` → NSE `-EQ` symbols
- **Candles**: `getCandleData` → OHLCV
- **Live LTP**: `getLtpData` polled every 5s (updates last candle)

## Security

If credentials were shared in chat or committed by mistake, **rotate your API key and TOTP** in the [Angel SmartAPI portal](https://smartapi.angelbroking.com/).

`.env.local` is gitignored.

## Scripts

```bash
npm run dev
npm run build
npm run start
```
