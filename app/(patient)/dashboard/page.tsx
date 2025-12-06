"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import WorkflowGuard from '@/components/WorkflowGuard';
import RiskBadge from '@/components/RiskBadge';
import RecommendedActionCard from '@/components/RecommendedActionCard';
import TrendChart from '@/components/TrendChart';
import { useWorkflow } from '@/context/WorkflowContext';
import { fetcher } from '@/lib/fetcher';

type RiskBand = 'green' | 'yellow' | 'red';

type DashboardResponse = {
  patient: {
    id: string;
    bedNumber: string;
    initials: string;
    insertionDate: string;
    daysSinceInsertion: number;
  };
  riskSnapshot?: {
    clisaScore: number;
    predictiveClabsiScore: number;
    predictiveClabsiBand: RiskBand;
    predictiveVenousResistanceBand: RiskBand;
    recommendedAction: string;
    tractionPullsYellow: number;
    tractionPullsRed: number;
    riskPhase: 'early' | 'late';
    earlyClabsiScore: number;
    lateClabsiScore: number;
    trendPenalty: number;
    adaptiveTractionAlert: boolean;
  } | null;
  latestCapture?: {
    imageUrl: string;
  } | null;
  trend?: Array<{
    timestamp: string;
    score: number;
    band: RiskBand;
    dressingChange: boolean;
    catheterChange: boolean;
    flushing: boolean;
    tractionPullsYellow?: number;
    tractionPullsRed?: number;
    adaptiveTractionAlert?: boolean;
  }>;
};

const clisaGuidanceMatrix = [
  {
    label: '0-1',
    min: 0,
    max: 1,
    meaning: 'Clean, intact dressing with no erythema or ooze',
    action: 'Routine care; reassess in 12 hours while maintaining sterile caps'
  },
  {
    label: '2-3',
    min: 2,
    max: 3,
    meaning: 'Mild erythema or moisture suggesting early tissue change',
    action: 'Reinforce dressing, document traction pulls, and re-image on the next shift'
  },
  {
    label: '4+',
    min: 4,
    max: null,
    meaning: 'Significant drainage, maceration, or catheter lift',
    action: 'Replace dressing, escalate to the medical officer, prepare for a line change'
  }
] as const;

const getClisaGuidance = (score?: number) => {
  if (typeof score !== 'number') return null;
  return (
    clisaGuidanceMatrix.find((row) => score >= row.min && (row.max === null || score <= row.max)) ?? null
  );
};

const venousRecommendations: Record<RiskBand, string> = {
  green: 'Continue securement; document traction checks in the next shift.',
  yellow: 'Reinforce traction device, monitor venous resistance, and brief the charge nurse.',
  red: 'Initiate venous resistance protocol and request urgent vascular review.'
};

const legendClasses: Record<RiskBand, string> = {
  green: 'bg-risk-green/15 text-risk-green border border-risk-green/30',
  yellow: 'bg-risk-yellow/15 text-risk-yellow border border-risk-yellow/30',
  red: 'bg-risk-red/15 text-risk-red border border-risk-red/30'
};

const phaseDescriptions: Record<'early' | 'late', string> = {
  early: 'Early phase (≤ 3 days): dressing + patient factors prioritized',
  late: 'Late phase (> 3 days): traction + trend penalties layered in'
};

const colorLegend: Array<{ level: RiskBand; copy: string }> = [
  { level: 'green', copy: 'Green = intact site, continue routine care' },
  { level: 'yellow', copy: 'Yellow = mild changes, reinforce dressing' },
  { level: 'red', copy: 'Red = escalating risk, activate CLABSI bundle' }
];

const interventionLegend = [
  { icon: '⚪', meaning: 'Dressing change documented' },
  { icon: '⚫', meaning: 'Catheter change' },
  { icon: '🟣', meaning: 'Flush / venous intervention' }
];

export default function DashboardPage() {
  const router = useRouter();
  const { patientId, stage, advanceTo, reset } = useWorkflow();
  const { data, error, mutate } = useSWR<DashboardResponse>(
    patientId ? `/api/dashboard?patientId=${patientId}` : null,
    fetcher
  );
  const [showClisa, setShowClisa] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clisaGuidance = data?.riskSnapshot ? getClisaGuidance(data.riskSnapshot.clisaScore) : null;
  const totalPulls = data?.riskSnapshot
    ? data.riskSnapshot.tractionPullsYellow + data.riskSnapshot.tractionPullsRed
    : 0;
  const isPatientMissing = useMemo(
    () => errorMessage?.toLowerCase().includes('patient not found') ?? false,
    [errorMessage]
  );

  useEffect(() => {
    if (stage === 'dashboard') {
      advanceTo('alerts');
    }
  }, [stage, advanceTo]);

  useEffect(() => {
    if (!error) {
      setErrorMessage(null);
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to load dashboard.';
    setErrorMessage(message);
  }, [error]);

  const handleReset = () => {
    reset();
    router.push('/patient');
  };

  if (!patientId) {
    return <p className="px-4 py-8 text-center text-sm">Select a patient to view the dashboard.</p>;
  }

  return (
    <WorkflowGuard requiredStage="dashboard">
      <PageShell title="Patient Dashboard" subtitle="Continuous surveillance">
        {error ? (
          <section className="card border border-risk-red/30 bg-risk-red/5 space-y-2">
            <p className="text-sm font-semibold text-risk-red">Unable to load dashboard.</p>
            {errorMessage ? <p className="text-xs text-slate-600">Server response: {errorMessage}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => mutate()}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-risk-red border border-risk-red/40"
              >
                Retry fetch
              </button>
              {isPatientMissing ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full bg-risk-red text-white px-4 py-2 text-xs font-semibold"
                >
                  Re-identify patient
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
        {!data ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {data ? (
          <>
            <section className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Patient summary</p>
              <h2 className="text-xl font-semibold">Bed {data.patient.bedNumber} - {data.patient.initials}</h2>
              <p className="text-sm text-slate-600">Insertion {data.patient.daysSinceInsertion} days ago ({data.patient.insertionDate})</p>
            </section>

            <section className="card space-y-3 border border-sky-100 bg-gradient-to-br from-sky-50 to-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">CLISA score</p>
                  <p className="text-4xl font-black text-slate-900">{data.riskSnapshot?.clisaScore ?? '—'}</p>
                  <p className="text-sm text-slate-500">Latest 12-hour capture</p>
                </div>
                {data.riskSnapshot ? (
                  <RiskBadge
                    level={data.riskSnapshot.predictiveClabsiBand}
                    label={`CLABSI ${data.riskSnapshot.predictiveClabsiBand.toUpperCase()}`}
                  />
                ) : null}
              </div>
              {data.riskSnapshot ? (
                <>
                  {clisaGuidance ? (
                    <div className="rounded-2xl border border-slate-100 bg-white/70 px-3 py-2 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Interpretation</p>
                      <p className="text-sm text-slate-700">{clisaGuidance.meaning}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Recommended action</p>
                      <p className="text-sm font-semibold text-slate-900">{clisaGuidance.action}</p>
                    </div>
                  ) : null}
                  <p className="text-xs text-slate-500">Pulls over last 12h: {totalPulls}</p>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-teal">
                    <button type="button" className="underline" onClick={() => setShowClisa(true)}>
                      Open inline CLISA reference
                    </button>
                    <Link href="/clisa-reference" className="underline">
                      View full CLISA reference table
                    </Link>
                  </div>
                </>
              ) : null}
            </section>

            {data.riskSnapshot ? (
              <section className="card space-y-3">
                <p className="text-sm font-semibold text-slate-800">Predictive risk summary</p>
                <p className="text-xs text-slate-500">{phaseDescriptions[data.riskSnapshot.riskPhase]}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Predictive CLABSI risk</p>
                    <p className="text-base font-semibold capitalize text-slate-900">{data.riskSnapshot.predictiveClabsiBand}</p>
                  </div>
                  <RiskBadge
                    level={data.riskSnapshot.predictiveClabsiBand}
                    label={`CLABSI ${data.riskSnapshot.predictiveClabsiBand.toUpperCase()}`}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {colorLegend.map((legend) => (
                    <span key={legend.copy} className={`rounded-full px-3 py-1 ${legendClasses[legend.level]}`}>
                      {legend.copy}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <p className="uppercase tracking-wide text-[10px] text-slate-400">Early CLABSI score</p>
                    <p className="text-sm font-semibold text-slate-900">{data.riskSnapshot.earlyClabsiScore}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-[10px] text-slate-400">Late CLABSI score</p>
                    <p className="text-sm font-semibold text-slate-900">{data.riskSnapshot.lateClabsiScore}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-[10px] text-slate-400">Trend penalty</p>
                    <p className="text-sm font-semibold text-slate-900">{data.riskSnapshot.trendPenalty}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-[10px] text-slate-400">Adaptive traction</p>
                    <p className={`text-sm font-semibold ${data.riskSnapshot.adaptiveTractionAlert ? 'text-risk-red' : 'text-slate-700'}`}>
                      {data.riskSnapshot.adaptiveTractionAlert ? 'Triggered' : 'Not triggered'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Predictive venous resistance</p>
                    <p className="text-base font-semibold capitalize text-slate-900">{data.riskSnapshot.predictiveVenousResistanceBand}</p>
                  </div>
                  <RiskBadge
                    level={data.riskSnapshot.predictiveVenousResistanceBand}
                    label={`VENOUS ${data.riskSnapshot.predictiveVenousResistanceBand.toUpperCase()}`}
                  />
                </div>
                {data.riskSnapshot.adaptiveTractionAlert ? (
                  <p className="text-xs text-risk-red font-semibold">
                    Adaptive hardware detected patient-driven traction risk. Follow the venous resistance protocol immediately.
                  </p>
                ) : null}
              </section>
            ) : null}

            {data.riskSnapshot ? (
              <section className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">Predictive risk &amp; actions</p>
                <div className="grid gap-3">
                  <RecommendedActionCard
                    band={data.riskSnapshot.predictiveClabsiBand}
                    action={data.riskSnapshot.recommendedAction}
                    title="CLABSI risk &amp; action"
                  />
                  <RecommendedActionCard
                    band={data.riskSnapshot.predictiveVenousResistanceBand}
                    action={venousRecommendations[data.riskSnapshot.predictiveVenousResistanceBand]}
                    title="Venous resistance risk &amp; action"
                  />
                </div>
              </section>
            ) : null}

            <section className="card space-y-2">
              <p className="text-sm font-semibold text-slate-700">Latest catheter-site image</p>
              {data.latestCapture ? (
                <button type="button" onClick={() => setShowImage(true)} className="w-full">
                  <Image
                    src={data.latestCapture.imageUrl}
                    alt="Latest catheter image"
                    width={320}
                    height={240}
                    className="rounded-2xl object-cover"
                    unoptimized
                  />
                </button>
              ) : (
                <p className="text-sm text-slate-500">No capture yet.</p>
              )}
            </section>

            <section className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">12-hour trend</p>
                <span className="text-xs text-slate-400">Live feed</span>
              </div>
              <TrendChart data={data.trend ?? []} />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legend</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {colorLegend.map((legend) => (
                    <span key={`trend-${legend.copy}`} className={`rounded-full px-3 py-1 ${legendClasses[legend.level]}`}>
                      {legend.copy}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                  {interventionLegend.map((entry) => (
                    <span key={entry.icon} className="flex items-center gap-1">
                      <span aria-hidden="true">{entry.icon}</span>
                      {entry.meaning}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {showClisa ? <ClisaModal onClose={() => setShowClisa(false)} /> : null}
            {showImage && data?.latestCapture ? (
              <ImageModal imageUrl={data.latestCapture.imageUrl} onClose={() => setShowImage(false)} />
            ) : null}
          </>
        ) : null}
      </PageShell>
    </WorkflowGuard>
  );
}

type ModalProps = {
  onClose: () => void;
};

const clisaReference = clisaGuidanceMatrix.map((row) => ({ score: row.label, meaning: row.meaning, action: row.action }));

function ClisaModal({ onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-2xl bg-white p-4 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">CLISA Reference</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>
        <div className="space-y-2">
          {clisaReference.map((row) => (
            <div key={row.score} className="rounded-xl border border-slate-200 px-3 py-2">
              <p className="text-sm font-semibold">Score {row.score}</p>
              <p className="text-xs text-slate-600">{row.meaning}</p>
              <p className="text-xs text-teal font-semibold">{row.action}</p>
            </div>
          ))}
        </div>
        <Link href="/clisa-reference" className="text-xs text-teal underline">
          View the complete CLISA reference table
        </Link>
      </div>
    </div>
  );
}

function ImageModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal>
      <div className="w-full max-w-md bg-white rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Latest capture</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>
        <Image src={imageUrl} alt="Catheter capture" width={360} height={360} className="rounded-2xl" unoptimized />
      </div>
    </div>
  );
}
