"use client";

import { supabase } from "@/lib/supabase/client";
import type {
  CashFlowEntry,
  CashFlowEntryInput,
  SignalNotification,
  Transaction,
  TransactionInput,
} from "@/lib/types";

interface ApiErrorOptions {
  message: string;
  status: number;
}

export class ApiError extends Error {
  status: number;

  constructor({ message, status }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

async function requestJson<T>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError({
      status: 401,
      message: "Sign in is required to sync with Supabase.",
    });
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new ApiError({ status: response.status, message });
  }

  return (await response.json()) as T;
}

export async function fetchTransactions(limit = 200): Promise<Transaction[]> {
  const payload = await requestJson<{ transactions: Transaction[] }>(
    `/api/transactions?limit=${limit}`
  );
  return payload.transactions;
}

export async function createTransaction(
  input: TransactionInput
): Promise<Transaction> {
  const payload = await requestJson<{ transaction: Transaction }>(
    "/api/transactions",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return payload.transaction;
}

export async function fetchCashJournal(limit = 200): Promise<CashFlowEntry[]> {
  const payload = await requestJson<{ entries: CashFlowEntry[] }>(
    `/api/cash-journal?limit=${limit}`
  );
  return payload.entries;
}

export async function createCashJournalEntry(
  input: CashFlowEntryInput
): Promise<CashFlowEntry> {
  const payload = await requestJson<{ entry: CashFlowEntry }>(
    "/api/cash-journal",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return payload.entry;
}

export async function fetchSignalNotifications(
  limit = 120
): Promise<SignalNotification[]> {
  const payload = await requestJson<{ notifications: SignalNotification[] }>(
    `/api/signal-notifications?limit=${limit}`
  );
  return payload.notifications;
}

export async function fetchMarketPrices(
  tickers: string[]
): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};
  try {
    const params = new URLSearchParams({ tickers: tickers.join(",") });
    const response = await fetch(`/api/market-prices?${params.toString()}`);
    if (!response.ok) return {};
    const data = await response.json();
    return data.prices || {};
  } catch (err) {
    console.error("Failed to fetch market prices:", err);
    return {};
  }
}
