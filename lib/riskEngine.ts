import { differenceInDays } from 'date-fns';
import type { RiskBand, RiskPhase } from '@prisma/client';
import { clamp } from './utils';

export type PatientFactorFlags = {
  agitation: boolean;
  extremesAgeWeightObesity: boolean;
  comorbidities: boolean;
  immuneNutrition: boolean;
};

export type SafetyChecklist = {
  capsClosed: boolean;
  glovesWorn: boolean;
  noAbnormalities: boolean;
  dressingIntact: boolean;
};

export type ImageSignals = {
  erythema: number; // 0-3
  drainage: number;
  ooze: number;
  moisture: number;
  dressingLift: number; // percentage 0-100
  chgPatch: boolean;
  maceration: boolean;
};

type RiskInput = {
  insertionDate: Date;
  patientFactors: PatientFactorFlags;
  safetyChecklist: SafetyChecklist;
  tractionPullsYellow: number;
  tractionPullsRed: number;
  dressingChanged: boolean;
  catheterChanged: boolean;
  flushingDone: boolean;
  signals?: Partial<ImageSignals>;
  adaptiveTractionAlert?: boolean;
  trendDeterioration?: number;
  nightModeAssist?: boolean;
  riskPhaseOverride?: RiskPhase;
};

const actionMatrix: Record<RiskBand, string> = {
  green: 'Routine flush every 24h and document site',
  yellow: 'Flush every 12h, reinforce dressing, inform medical officer',
  red: 'Stop infusions, urgent ultrasound, initiate sepsis protocol'
};

export const bandFromScore = (score: number): RiskBand => {
  if (score <= 3) return 'green';
  if (score <= 6) return 'yellow';
  return 'red';
};

const venousBandFromTraction = (yellow: number, red: number): RiskBand => {
  if (red >= 2 || yellow >= 4) return 'red';
  if (red >= 1 || yellow >= 2) return 'yellow';
  return 'green';
};

const scoreClisa = (signals: ImageSignals, dressingIntact: boolean) => {
  let score = signals.erythema + signals.drainage + signals.ooze + signals.moisture;
  if (!dressingIntact) score += 1;
  if (signals.dressingLift > 25) score += 1;
  if (signals.maceration) score += 1;
  if (!signals.chgPatch) score += 1;
  return clamp(score, 0, 4);
};

const scoreTraction = (yellow: number, red: number, events: { dressingChanged: boolean; catheterChanged: boolean }) => {
  let score = 0;
  if (yellow >= 1) score += 1;
  if (yellow >= 3) score += 1;
  if (red >= 1) score += 2;
  if (events.catheterChanged) score += 1;
  if (events.dressingChanged) score += 0.5;
  return clamp(score, 0, 3);
};

const scorePatientFactors = (flags: PatientFactorFlags) => {
  const count = Object.values(flags).filter(Boolean).length;
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
};

const dwellAdjustment = (insertionDate: Date) => {
  const days = differenceInDays(new Date(), insertionDate);
  return days > 9 ? 1 : 0;
};

const determinePhase = (insertionDate: Date, override?: RiskPhase): RiskPhase => {
  if (override) return override;
  const days = differenceInDays(new Date(), insertionDate);
  return days <= 3 ? 'early' : 'late';
};

// TODO: replace this deterministic fallback with CV inference outputs from the catheter-site model.
const defaultSignals: ImageSignals = {
  erythema: 1,
  drainage: 0,
  ooze: 0,
  moisture: 1,
  dressingLift: 5,
  chgPatch: true,
  maceration: false
};

export const calculateRiskSnapshot = (input: RiskInput) => {
  const signals = { ...defaultSignals, ...input.signals } satisfies ImageSignals;
  const clisaScore = scoreClisa(signals, input.safetyChecklist.dressingIntact);
  const tractionScore = scoreTraction(input.tractionPullsYellow, input.tractionPullsRed, {
    dressingChanged: input.dressingChanged,
    catheterChanged: input.catheterChanged
  });
  const patientScore = scorePatientFactors(input.patientFactors);
  const dwellScore = dwellAdjustment(input.insertionDate);

  const imagingBonus = input.nightModeAssist ? -1 : 0;
  const adaptiveTractionBonus = input.adaptiveTractionAlert ? 1 : 0;
  const trendPenalty = clamp(input.trendDeterioration ?? 0, 0, 3);

  const adjustedTractionScore = clamp(tractionScore + adaptiveTractionBonus, 0, 4);
  const earlyClabsiScore = Math.round(clamp(clisaScore + patientScore + dwellScore + imagingBonus));
  const lateClabsiScore = Math.round(clamp(earlyClabsiScore + adjustedTractionScore + trendPenalty));
  const riskPhase = determinePhase(input.insertionDate, input.riskPhaseOverride);
  const predictiveClabsiScore = riskPhase === 'early' ? earlyClabsiScore : lateClabsiScore;
  const predictiveClabsiBand = bandFromScore(predictiveClabsiScore);
  let predictiveVenousResistanceBand = venousBandFromTraction(
    input.tractionPullsYellow,
    input.tractionPullsRed
  );
  if (input.adaptiveTractionAlert && predictiveVenousResistanceBand !== 'red') {
    predictiveVenousResistanceBand = predictiveVenousResistanceBand === 'green' ? 'yellow' : 'red';
  }

  const recommendedAction = (() => {
    if (predictiveClabsiScore <= 3) return 'Routine flush Q24h';
    if (predictiveClabsiScore <= 6) return 'Flush Q12h + inform MO';
    if (predictiveClabsiScore <= 9) return 'Venous trauma protocol + urgent ultrasound';
    return 'Stop infusions + emergency MO review / sepsis protocol';
  })();

  return {
    clisaScore,
    predictiveClabsiScore,
    predictiveClabsiBand,
    predictiveVenousResistanceBand,
    recommendedAction,
    tractionPullsYellow: input.tractionPullsYellow,
    tractionPullsRed: input.tractionPullsRed,
    riskPhase,
    earlyClabsiScore,
    lateClabsiScore,
    trendPenalty: Math.round(trendPenalty),
    adaptiveTractionAlert: Boolean(input.adaptiveTractionAlert)
  };
};

export type RiskComputation = ReturnType<typeof calculateRiskSnapshot>;

export const resourceBandFromRate = (rate: number): RiskBand => {
  if (rate <= 10) return 'green';
  if (rate <= 30) return 'yellow';
  if (rate <= 60) return 'yellow';
  return 'red';
};
