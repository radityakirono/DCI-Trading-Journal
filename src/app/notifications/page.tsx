'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRealtimeSignals } from '@/lib/hooks/useRealtimeSignals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TradeTicket {
  target_entry?: number;
  size_lots?: number;
  risk_amount?: number;
}

interface QuantSignal {
  id: string;
  signal_ts: string;
  ticker: string;
  ticker_short: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD' | 'ALERT';
  raw_action: string;
  message: string;
  regime: string | null;
  conviction: number | null;
  supporting_metrics: Record<string, unknown>;
  trade_ticket: TradeTicket | null;
  delivery_status: string;
  read_at: string | null;
}

interface SignalRun {
  run_id: string;
  slot_key: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  engine_version: string | null;
  metrics: Record<string, unknown>;
}

const SIGNAL_BADGE_VARIANTS: Record<string, string> = {
  BUY: 'bg-emerald-600 text-white',
  SELL: 'bg-red-600 text-white',
  HOLD: 'bg-amber-500 text-black',
  ALERT: 'bg-blue-600 text-white',
};

const RUN_STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-600 text-white',
  RUNNING: 'bg-blue-500 text-white animate-pulse',
  FAILED: 'bg-red-600 text-white',
  SKIPPED: 'bg-zinc-500 text-white',
  PARTIAL: 'bg-amber-500 text-black',
};

export default function NotificationsPage() {
  const [signals, setSignals] = useState<QuantSignal[]>([]);
  const [runs, setRuns] = useState<SignalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { newSignals, isConnected } = useRealtimeSignals();

  const fetchSignals = useCallback(async () => {
    try {
      const [signalsRes, runsRes] = await Promise.all([
        fetch('/api/signals?limit=50'),
        fetch('/api/signal-runs?limit=10'),
      ]);

      if (!signalsRes.ok || !runsRes.ok) {
        throw new Error('Failed to fetch signal data');
      }

      const signalsData = await signalsRes.json();
      const runsData = await runsRes.json();

      setSignals(signalsData.signals || []);
      setRuns(runsData.runs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Merge realtime signals into the list
  const allSignals = [
    ...newSignals.filter(
      (ns) => !signals.some((s) => s.id === ns.id)
    ),
    ...signals,
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Signal Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated trading signals from the QuantLite Alpha engine
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSignals}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pipeline runs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.run_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={RUN_STATUS_COLORS[run.status] || 'bg-zinc-500 text-white'}
                    >
                      {run.status}
                    </Badge>
                    <span className="text-sm font-mono">{run.slot_key}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(run.started_at).toLocaleString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                    })}
                    {run.engine_version && (
                      <span className="ml-2 opacity-60">{run.engine_version}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Trading Signals
            {allSignals.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({allSignals.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allSignals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No trading signals generated yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Signals will appear here automatically when the engine generates them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        className={SIGNAL_BADGE_VARIANTS[signal.signal_type] || 'bg-zinc-500'}
                      >
                        {signal.signal_type}
                      </Badge>
                      <span className="font-semibold text-lg">
                        {signal.ticker_short}
                      </span>
                      {signal.regime && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                          {signal.regime}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {signal.conviction !== null && (
                        <div className="text-sm font-medium">
                          {(signal.conviction * 100).toFixed(1)}% conviction
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(signal.signal_ts).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {signal.message}
                  </p>
                  {signal.trade_ticket && Object.keys(signal.trade_ticket).length > 0 ? (
                    <div className="mt-2 text-xs font-mono bg-muted/50 p-2 rounded">
                      {signal.trade_ticket.target_entry != null ? (
                        <span>Entry: Rp{Number(signal.trade_ticket.target_entry).toLocaleString('id-ID')}</span>
                      ) : null}
                      {signal.trade_ticket.size_lots != null ? (
                        <span className="ml-3">Size: {String(signal.trade_ticket.size_lots)} lots</span>
                      ) : null}
                      {signal.trade_ticket.risk_amount != null ? (
                        <span className="ml-3">Risk: Rp{Number(signal.trade_ticket.risk_amount).toLocaleString('id-ID')}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
