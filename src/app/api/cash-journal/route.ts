import { NextResponse, type NextRequest } from "next/server";

import { requireAuthenticatedClient } from "@/lib/supabase/server-auth";
import { cashFlowEntryInputSchema, listQuerySchema } from "@/lib/validation";
import type { CashFlowEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

type CashEntryRow = {
  id: string;
  date: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT";
  amount: number;
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
    .from("cash_journal")
    .select("id, date, type, amount, note")
    .eq("user_id", auth.user.id)
    .order("date", { ascending: false })
    .limit(parsedQuery.data.limit);

  if (error) {
    return NextResponse.json(
      { error: `Failed to load cash journal: ${error.message}` },
      { status: 500 }
    );
  }

  const entries: CashFlowEntry[] = ((data ?? []) as CashEntryRow[]).map((row) => ({
    id: row.id,
    date: row.date,
    type: row.type,
    amount: row.amount,
    note: row.note ?? undefined,
  }));

  return NextResponse.json({ entries });
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

  const parsedBody = cashFlowEntryInputSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid cash journal payload." },
      { status: 400 }
    );
  }

  const entry = parsedBody.data;

  const { data, error } = await auth.client
    .from("cash_journal")
    .insert({
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      date: entry.date,
      type: entry.type,
      amount: entry.amount,
      note: entry.note ?? null,
    })
    .select("id, date, type, amount, note")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create cash journal entry: ${error?.message ?? "Unknown error"}` },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      entry: {
        id: data.id,
        date: data.date,
        type: data.type,
        amount: data.amount,
        note: data.note ?? undefined,
      } satisfies CashFlowEntry,
    },
    { status: 201 }
  );
}
