import type { TradeSide } from "@/lib/types";

const SHARES_PER_LOT = 100;

export function calculateBrokerFee(
  side: TradeSide,
  quantityLots: number,
  price: number
): number {
  const gross = quantityLots * SHARES_PER_LOT * price;
  const feeRate = side === "BUY" ? 0.0015 : 0.0025;
  return Math.round(gross * feeRate);
}
