import { initialSignalNotifications } from "@/lib/mock-data";
import type { SignalNotification, SignalType } from "@/lib/types";

const SIGNAL_TYPES: SignalType[] = ["BUY", "SELL", "HOLD", "ALERT"];

export type SignalRow = {
  id: string;
  created_at: string;
  ticker: string;
  signal_type?: string | null;
  message: string;
  source?: string | null;
  confidence?: number | null;
  read_at?: string | null;
};

export function getDefaultSignalNotifications(): SignalNotification[] {
  return initialSignalNotifications;
}

export function normalizeSignalType(value?: string | null): SignalType {
  const normalized = value?.toUpperCase();
  if (normalized && SIGNAL_TYPES.includes(normalized as SignalType)) {
    return normalized as SignalType;
  }
  return "ALERT";
}

export function mapSignalRows(rows: SignalRow[]): SignalNotification[] {
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    ticker: row.ticker,
    type: normalizeSignalType(row.signal_type),
    message: row.message,
    source: row.source ?? undefined,
    confidence: row.confidence ?? null,
    isRead: Boolean(row.read_at),
  }));
}
