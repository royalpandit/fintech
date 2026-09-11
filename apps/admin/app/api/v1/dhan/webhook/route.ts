import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/dhan/webhook
 *
 * Registered as the Webhook URL in the Dhan API developer portal.
 * Dhan sends real-time order updates, trade confirmations, and
 * kill-switch events here.
 *
 * Dhan webhook payload shape (reference):
 * {
 *   "dhanClientId": "1000000003",
 *   "orderId": "112111182198",
 *   "correlationId": "123abc678",
 *   "orderStatus": "TRADED",          // TRANSIT | PENDING | PART_TRADED | TRADED | REJECTED | CANCELLED
 *   "transactionType": "BUY",         // BUY | SELL
 *   "exchangeSegment": "NSE_EQ",
 *   "productType": "INTRADAY",
 *   "orderType": "MARKET",
 *   "validity": "DAY",
 *   "tradingSymbol": "RELIANCE",
 *   "securityId": "2885",
 *   "quantity": 5,
 *   "price": 2500.00,
 *   "triggerPrice": 0.00,
 *   "afterMarketOrder": false,
 *   "boProfitValue": 0,
 *   "boStopLossValue": 0,
 *   "legName": "",
 *   "createTime": "2021-11-24 13:33:03",
 *   "updateTime": "2021-11-24 13:33:04",
 *   "exchangeTime": "2021-11-24 13:33:04",
 *   "drvExpiryDate": null,
 *   "drvOptionType": null,
 *   "drvStrikePrice": 0.00,
 *   "omsErrorCode": null,
 *   "omsErrorDescription": null
 * }
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Log every event so order fills are visible in PM2 / CloudWatch logs
  console.log("[Dhan Webhook]", JSON.stringify(body));

  // TODO: extend here — e.g. update paper trade status, push a browser
  // notification, or write the fill to the database.

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/v1/dhan/webhook
 *
 * Some brokers send a GET ping to verify the URL is reachable before
 * saving it. Return 200 so the Dhan portal accepts the URL.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "finuer-dhan-webhook" });
}
