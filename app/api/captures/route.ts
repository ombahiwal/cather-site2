import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildRiskAlerts } from '@/lib/alerts';
import { calculateRiskSnapshot, type PatientFactorFlags, type SafetyChecklist } from '@/lib/riskEngine';
import { analyzeCatheterImage } from '@/lib/gemini';
import { coerceTelemetryBoolean, coerceTelemetryCount, getShiftWindow } from '@/lib/shiftWindow';

export async function POST(request: Request) {
  const body = await request.json();
  const patient = await db.patient.findUnique({ where: { id: body.patientId } });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const catheterCapture = await db.imageCapture.create({
    data: {
      patientId: patient.id,
      imageType: 'catheter_site',
      imageUrl: body.catheterImageUrl,
      captureStatus: 'success'
    }
  });

  let tractionCapture = null;
  if (body.tractionImageUrl) {
    tractionCapture = await db.imageCapture.create({
      data: {
        patientId: patient.id,
        imageType: 'traction_module',
        imageUrl: body.tractionImageUrl,
        captureStatus: 'success'
      }
    });
  }

  const { periodStart, periodEnd } = getShiftWindow(new Date());
  const incomingCounts = {
    yellow: coerceTelemetryCount(body.tractionCounts?.yellow),
    red: coerceTelemetryCount(body.tractionCounts?.red)
  };
  const incomingEvents = {
    dressingChanged: coerceTelemetryBoolean(body.events?.dressingChanged),
    catheterChanged: coerceTelemetryBoolean(body.events?.catheterChanged),
    flushingDone: coerceTelemetryBoolean(body.events?.flushingDone)
  };
  const incomingAdaptive = coerceTelemetryBoolean(body.adaptiveTractionAlert);

  const recentShiftEvents = await db.shiftEvents.findFirst({
    where: {
      patientId: patient.id,
      periodEnd: { gte: periodStart }
    },
    orderBy: { periodEnd: 'desc' }
  });

  const shiftEvents = recentShiftEvents
    ? await db.shiftEvents.update({
        where: { id: recentShiftEvents.id },
        data: {
          periodEnd,
          tractionPullsYellow: incomingCounts.yellow ?? recentShiftEvents.tractionPullsYellow,
          tractionPullsRed: incomingCounts.red ?? recentShiftEvents.tractionPullsRed,
          dressingChanged: incomingEvents.dressingChanged ?? recentShiftEvents.dressingChanged,
          catheterChanged: incomingEvents.catheterChanged ?? recentShiftEvents.catheterChanged,
          flushingDone: incomingEvents.flushingDone ?? recentShiftEvents.flushingDone,
          adaptiveTractionAlert: incomingAdaptive ?? recentShiftEvents.adaptiveTractionAlert
        }
      })
    : await db.shiftEvents.create({
        data: {
          patientId: patient.id,
          periodStart,
          periodEnd,
          tractionPullsYellow: incomingCounts.yellow ?? 0,
          tractionPullsRed: incomingCounts.red ?? 0,
          dressingChanged: incomingEvents.dressingChanged ?? false,
          catheterChanged: incomingEvents.catheterChanged ?? false,
          flushingDone: incomingEvents.flushingDone ?? false,
          adaptiveTractionAlert: incomingAdaptive ?? false
        }
      });

  const patientFactors = patient.patientFactors as unknown as PatientFactorFlags;
  const safetyChecklist = patient.safetyChecklist as unknown as SafetyChecklist;

  const aiSignals = await analyzeCatheterImage(body.catheterImageUrl);

  const computation = calculateRiskSnapshot({
    insertionDate: patient.insertionDate,
    patientFactors,
    safetyChecklist,
    tractionPullsYellow: shiftEvents.tractionPullsYellow,
    tractionPullsRed: shiftEvents.tractionPullsRed,
    dressingChanged: shiftEvents.dressingChanged,
    catheterChanged: shiftEvents.catheterChanged,
    flushingDone: shiftEvents.flushingDone,
    signals: aiSignals ?? undefined,
    adaptiveTractionAlert: Boolean(body.adaptiveTractionAlert),
    trendDeterioration: body.trendDeterioration ?? 0,
    nightModeAssist: Boolean(body.nightModeAssist)
  });

  const riskSnapshot = await db.riskSnapshot.create({
    data: {
      patientId: patient.id,
      clisaScore: computation.clisaScore,
      predictiveClabsiScore: computation.predictiveClabsiScore,
      predictiveClabsiBand: computation.predictiveClabsiBand,
      predictiveVenousResistanceBand: computation.predictiveVenousResistanceBand,
      recommendedAction: computation.recommendedAction,
      tractionPullsYellow: computation.tractionPullsYellow,
      tractionPullsRed: computation.tractionPullsRed,
        shiftEventsId: shiftEvents.id,
      riskPhase: computation.riskPhase,
      earlyClabsiScore: computation.earlyClabsiScore,
      lateClabsiScore: computation.lateClabsiScore,
      trendPenalty: computation.trendPenalty,
      adaptiveTractionAlert: computation.adaptiveTractionAlert
    }
  });

  const alerts = buildRiskAlerts({
    predictiveClabsiBand: computation.predictiveClabsiBand,
    predictiveVenousResistanceBand: computation.predictiveVenousResistanceBand,
    tractionPullsRed: computation.tractionPullsRed,
    tractionPullsYellow: computation.tractionPullsYellow,
    dressingFailure:
      !safetyChecklist?.dressingIntact || (aiSignals?.dressingLift ?? 0) > 30 || Boolean(aiSignals?.maceration)
  });

  if (alerts.length) {
    await db.$transaction(
      alerts.map((alert) =>
        db.alert.create({
          data: {
            patientId: patient.id,
            type: alert.type,
            reason: alert.reason,
            severity: alert.severity,
            recommendedAction: alert.recommendedAction
          }
        })
      )
    );
  }

  return NextResponse.json({ catheterCapture, tractionCapture, riskSnapshot, aiSignals });
}
