"use client";

import { useEffect } from 'react';
import useSWR from 'swr';
import PageShell from '@/components/PageShell';
import WorkflowGuard from '@/components/WorkflowGuard';
import { useWorkflow } from '@/context/WorkflowContext';
import { fetcher } from '@/lib/fetcher';

type WardMetric = {
  id: string;
  wardId: string;
  date: string;
  clabsiCases: number;
  totalCentralLineDays: number;
  dressingChangeCount: number;
  catheterChangeCount: number;
  derivedRate: number;
};

type WardResponse = {
  metrics: WardMetric[];
  delta: number;
};

export default function WardAnalyticsPage() {
  const { stage, advanceTo } = useWorkflow();
  const { data } = useSWR<WardResponse>('/api/ward-metrics', fetcher, { refreshInterval: 60000 });

  useEffect(() => {
    if (stage === 'ward') {
      advanceTo('resource');
    }
  }, [stage, advanceTo]);

  const metrics = data?.metrics?.[0];
  const trend = data?.metrics ?? [];
  const delta = data?.delta ?? 0;
  const isLoading = !data;
  const noMetricsAvailable = Boolean(data && !metrics);
  const lookbackWindow = trend.slice(0, 7);
  const dressingUsage = lookbackWindow.reduce((sum, entry) => sum + entry.dressingChangeCount, 0);
  const catheterUsage = lookbackWindow.reduce((sum, entry) => sum + entry.catheterChangeCount, 0);
  const lineDaysWindow = lookbackWindow.reduce((sum, entry) => sum + entry.totalCentralLineDays, 0);

  return (
    <WorkflowGuard requiredStage="ward">
      <PageShell title="Ward Analytics" subtitle="CLABSI per 1000 line days">
        {isLoading ? <p className="text-sm text-slate-500">Loading ward metrics...</p> : null}
        {noMetricsAvailable ? (
          <p className="text-sm text-amber-600">
            No ward metrics found. Run the Prisma seed or ingest telemetry to view CLABSI performance.
          </p>
        ) : null}
        {metrics ? (
          <>
            <section className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
              <p className="text-3xl font-semibold">{metrics.derivedRate.toFixed(1)}</p>
              <p className="text-sm text-slate-600">CLABSI / 1000 catheter-days</p>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 pt-2">
                <div>
                  <p className="text-xs text-slate-500">Line days</p>
                  <p className="font-semibold">{metrics.totalCentralLineDays}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">CLABSI cases</p>
                  <p className="font-semibold">{metrics.clabsiCases}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Dressing changes</p>
                  <p className="font-semibold">{metrics.dressingChangeCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Catheter changes</p>
                  <p className="font-semibold">{metrics.catheterChangeCount}</p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${delta < 0 ? 'text-risk-green' : 'text-risk-red'}`}>
                {delta < 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(1)}% vs last 30 days
              </p>
            </section>

            <section className="card space-y-3">
              <p className="text-sm font-semibold">CLABSI rate trend</p>
              <svg viewBox="0 0 320 140" className="w-full" role="img">
                <polyline
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth={3}
                  points={trend
                    .map((point: WardMetric, index: number) => {
                      const x = (index / Math.max(trend.length - 1, 1)) * 320;
                      const y = 140 - (point.derivedRate / 10) * 140;
                      return `${x},${Math.max(Math.min(y, 140), 0)}`;
                    })
                    .join(' ')}
                />
              </svg>
            </section>

            {lookbackWindow.length ? (
              <section className="card space-y-2">
                <p className="text-sm font-semibold">Last 7 days consumption</p>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs text-slate-500">White dots (dressing changes)</p>
                    <p className="text-lg font-semibold">{dressingUsage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Black dots (catheter changes)</p>
                    <p className="text-lg font-semibold">{catheterUsage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total line days sampled</p>
                    <p className="text-lg font-semibold">{lineDaysWindow}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Average CLABSI / 1000d</p>
                    <p className="text-lg font-semibold">
                      {lookbackWindow.length ? (lookbackWindow.reduce((sum, entry) => sum + entry.derivedRate, 0) / lookbackWindow.length).toFixed(1) : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Dressing (⚪) and catheter (⚫) counts mirror the patient dashboard legend so nursing and procurement teams can reconcile supply usage.
                </p>
              </section>
            ) : null}
          </>
        ) : null}
      </PageShell>
    </WorkflowGuard>
  );
}
