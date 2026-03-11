/**
 * GET /api/signals — Fetch quant signals from Supabase.
 *
 * Uses the service_role admin client to bypass RLS.
 * Supports ?limit=N (default 50) and ?status=PENDING|SENT etc.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status');
    const signalType = searchParams.get('signal_type');

    let query = supabaseAdmin
      .from('quant_signals')
      .select(`
        id,
        external_signal_key,
        run_id,
        created_at,
        signal_ts,
        ticker,
        ticker_short,
        signal_type,
        raw_action,
        model_name,
        message,
        source,
        regime,
        conviction,
        supporting_metrics,
        trade_ticket,
        delivery_status,
        read_at
      `)
      .order('signal_ts', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('delivery_status', status);
    }
    if (signalType) {
      query = query.eq('signal_type', signalType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API /signals] Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ signals: data || [] });
  } catch (err) {
    console.error('[API /signals] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
