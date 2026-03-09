import { NextResponse, type NextRequest } from "next/server";

import { calculateBrokerFee } from "@/lib/trading";
import { requireAuthenticatedClient } from "@/lib/supabase/server-auth";
import { listQuerySchema, transactionInputSchema } from "@/lib/validation";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

type TransactionRow = {
  id: string;
  date: string;
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee: number;
  note?: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedClient(request);
  if ("error" in auth) return auth.error;

  const parsedQuery = listQuerySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit"),
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("transactions")
    .select("id, date, ticker, side, quantity, price, fee, note")
    .eq("user_id", auth.user.id)
    .order("date", { ascending: false })
    .limit(parsedQuery.data.limit);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load transactions: ${error.message}` },
      { status: 500 }
    );
  }

  const transactions: Transaction[] = ((data ?? []) as TransactionRow[]).map((row) => ({
    id: row.id,
    date: row.date,
    ticker: row.ticker,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
    fee: row.fee,
    note: row.note ?? undefined,
  }));

  return NextResponse.json({ transactions });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedClient(request);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsedBody = transactionInputSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid transaction payload." },
      { status: 400 }
    );
  }

  const transaction = parsedBody.data;
  const fee = calculateBrokerFee(
    transaction.side,
    transaction.quantity,
    transaction.price
  );

  const { data, error } = await auth.client
    .from("transactions")
    .insert({
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      date: transaction.date,
      ticker: transaction.ticker,
      side: transaction.side,
      quantity: transaction.quantity,
      price: transaction.price,
      fee,
      note: transaction.note ?? null,
    })
    .select("id, date, ticker, side, quantity, price, fee, note")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create transaction: ${error?.message ?? "Unknown error"}` },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      transaction: {
        id: data.id,
        date: data.date,
        ticker: data.ticker,
        side: data.side,
        quantity: data.quantity,
        price: data.price,
        fee: data.fee,
        note: data.note ?? undefined,
      } satisfies Transaction,
    },
    { status: 201 }
  );
}
