"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, ChartCandlestick, Wallet } from "lucide-react";

import { DciLogo } from "@/components/brand/dci-logo";
import { AnimatedSection } from "@/components/dashboard/animated-section";
import { DepositWithdrawalJournal } from "@/components/dashboard/deposit-withdrawal-journal";
import { EquityChart } from "@/components/dashboard/equity-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PortfolioTable } from "@/components/dashboard/portfolio-table";
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ApiError,
  createCashJournalEntry,
  createTransaction,
  fetchCashJournal,
  fetchTransactions,
} from "@/lib/api-client";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import {
  initialCashJournal,
  initialEquitySeries,
  initialTransactions,
  marketPrices,
} from "@/lib/mock-data";
import { calculateBrokerFee } from "@/lib/trading";
import type {
  CashFlowEntry,
  CashFlowEntryInput,
  Transaction,
  TransactionInput,
} from "@/lib/types";

const SHARES_PER_LOT = 100;

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [cashJournal, setCashJournal] = useState<CashFlowEntry[]>(initialCashJournal);
  const [signalCount, setSignalCount] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string>("");

  const latestEquity = initialEquitySeries[initialEquitySeries.length - 1]?.equity ?? 0;
  const previousEquity = initialEquitySeries[initialEquitySeries.length - 2]?.equity ?? 0;
  const dailyPnl = initialEquitySeries[initialEquitySeries.length - 1]?.dailyPnl ?? 0;
  const dayChange = latestEquity - previousEquity;
  const dayChangePercent = previousEquity > 0 ? dayChange / previousEquity : 0;

  const netCashFlow = useMemo(
    () =>
      cashJournal.reduce((sum, entry) => {
        if (entry.type === "DEPOSIT") return sum + entry.amount;
        if (entry.type === "WITHDRAWAL") return sum - entry.amount;
        return sum + entry.amount;
      }, 0),
    [cashJournal]
  );

  const tradedVolume = useMemo(
    () =>
      transactions.reduce(
        (sum, trade) => sum + trade.quantity * SHARES_PER_LOT * trade.price,
        0
      ),
    [transactions]
  );

  const activeTickers = useMemo(
    () => new Set(transactions.map((trade) => trade.ticker)).size,
    [transactions]
  );

  async function handleCreateTransaction(input: TransactionInput) {
    try {
      const created = await createTransaction(input);
      setTransactions((current) => [created, ...current]);
      setSyncNotice("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const fallback: Transaction = {
          id: crypto.randomUUID(),
          date: input.date,
          ticker: input.ticker,
          side: input.side,
          quantity: input.quantity,
          price: input.price,
          fee: calculateBrokerFee(input.side, input.quantity, input.price),
          note: input.note,
        };
        setTransactions((current) => [fallback, ...current]);
        setSyncNotice("Not signed in. Transaction was saved locally only.");
        return;
      }

      throw error instanceof Error
        ? error
        : new Error("Failed to save transaction.");
    }
  }

  async function handleCreateCashEntry(input: CashFlowEntryInput) {
    try {
      const created = await createCashJournalEntry(input);
      setCashJournal((current) => [created, ...current]);
      setSyncNotice("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const fallback: CashFlowEntry = {
          id: crypto.randomUUID(),
          date: input.date,
          type: input.type,
          amount: input.amount,
          note: input.note,
        };
        setCashJournal((current) => [fallback, ...current]);
        setSyncNotice("Not signed in. Journal entry was saved locally only.");
        return;
      }

      throw error instanceof Error
        ? error
        : new Error("Failed to save journal entry.");
    }
  }

  const loadCoreData = useCallback(async () => {
    try {
      const [remoteTransactions, remoteCashJournal] = await Promise.all([
        fetchTransactions(),
        fetchCashJournal(),
      ]);

      setTransactions(remoteTransactions);
      setCashJournal(remoteCashJournal);
      setSyncNotice("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSyncNotice("Sign in to sync transactions and cash journal with Supabase.");
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to sync data.";
      console.error("Failed to sync core data:", message);
    }
  }, []);

  const loadSignalNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/signals?limit=50');
      if (!res.ok) throw new Error('Failed to load signals');
      const data = await res.json() as { signals: { id: string; read_at: string | null }[] };
      const unread = (data.signals || []).filter((s) => !s.read_at).length;
      setSignalCount(unread);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      console.error("Failed to load signal count:", message);
    }
  }, []);

  useEffect(() => {
    const run = () => {
      void loadCoreData();
      void loadSignalNotifications();
    };

    const initialTimer = window.setTimeout(run, 0);

    return () => {
      window.clearTimeout(initialTimer);
    };
  }, [loadCoreData, loadSignalNotifications]);

  useEffect(() => {
    const run = () => {
      void loadSignalNotifications();
    };

    const initialTimer = window.setTimeout(run, 0);
    const intervalTimer = window.setInterval(run, 60_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [loadSignalNotifications]);

  return (
    <div className="relative min-h-screen bg-background pb-12">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(90%_70%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_72%)]" />

      <main className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <DciLogo />
          <div className="flex items-center gap-2">
            <NotificationBell unreadCount={signalCount} />
            <ThemeToggle />
          </div>
        </div>

        {syncNotice ? (
          <p className="mb-3 text-sm text-amber-500">{syncNotice}</p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-12">
          <AnimatedSection id="equity" className="h-full xl:col-span-8">
            <EquityChart data={initialEquitySeries} />
          </AnimatedSection>
          <AnimatedSection id="transactions" className="h-full xl:col-span-4">
            <TransactionForm onCreate={handleCreateTransaction} />
          </AnimatedSection>
        </div>

        <AnimatedSection id="metrics" className="mt-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Equity"
              value={formatCompactCurrency(latestEquity)}
              delta={`${dayChange >= 0 ? "+" : ""}${formatCurrency(dayChange)} (${formatPercent(dayChangePercent)})`}
              tone={dayChange >= 0 ? "positive" : "negative"}
              icon={Wallet}
            />
            <MetricCard
              title="Daily P/L"
              value={formatCurrency(dailyPnl)}
              delta={dailyPnl >= 0 ? "Daily Profit" : "Daily Loss"}
              tone={dailyPnl >= 0 ? "positive" : "negative"}
              icon={Activity}
            />
            <MetricCard
              title="Net Cash Flow"
              value={formatCompactCurrency(netCashFlow)}
              delta="Deposits, withdrawals, adjustments"
              tone={netCashFlow >= 0 ? "positive" : "negative"}
              icon={ArrowUpRight}
            />
            <MetricCard
              title="Trading Exposure"
              value={formatCompactCurrency(tradedVolume)}
              delta={`${activeTickers} active IDX tickers`}
              tone="neutral"
              icon={ChartCandlestick}
            />
          </section>
        </AnimatedSection>

        <div className="mt-6 space-y-6">
          <AnimatedSection id="portfolio">
            <PortfolioTable transactions={transactions} marketPrices={marketPrices} />
          </AnimatedSection>
          <AnimatedSection id="journal">
            <DepositWithdrawalJournal
              entries={cashJournal}
              onCreate={handleCreateCashEntry}
            />
          </AnimatedSection>
        </div>
      </main>
    </div>
  );
}
