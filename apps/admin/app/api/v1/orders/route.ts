import { NextResponse, type NextRequest } from "next/server";
import { placeOrder, getOrderBook, setAccessToken, isAuthenticated, type OrderParams } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
  }
  try {
    const data = await getOrderBook();
    // Kite returns orders in data.data
    const orders = (data.data ?? []).map((o: Record<string, unknown>) => ({
      updatetime:      o.order_timestamp,
      tradingsymbol:   o.tradingsymbol,
      transactiontype: o.transaction_type,
      quantity:        o.quantity,
      price:           o.price,
      status:          o.status,
      orderid:         o.order_id,
      product:         o.product,
      order_type:      o.order_type,
    }));
    return NextResponse.json({ ok: true, data: orders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg, data: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
  }
  try {
    const body = await req.json() as OrderParams;
    const result = await placeOrder(body);
    if (result.data?.order_id) {
      return NextResponse.json({ ok: true, orderId: result.data.order_id, message: result.message });
    }
    return NextResponse.json({ ok: false, error: result.message ?? "Order failed" }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/orders POST]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
