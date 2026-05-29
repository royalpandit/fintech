/** Map app exchange codes → Angel SmartAPI WebSocket exchangeType. */

const EXCHANGE_TYPE: Record<string, number> = {
  NSE: 1,
  NFO: 2,
  BSE: 3,
  BFO: 4,
  MCX: 5,
  NCX: 7,
  CDE: 13,
};

export function toAngelExchangeType(exchange: string): number {
  return EXCHANGE_TYPE[exchange.toUpperCase()] ?? 1;
}

export function subscriptionKey(exchange: string, token: string): string {
  return `${exchange.toUpperCase()}:${token}`;
}
