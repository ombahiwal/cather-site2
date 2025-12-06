import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { coerceTelemetryBoolean, coerceTelemetryCount, getShiftWindow } from '@/lib/shiftWindow';

export async function POST(request: Request) {
  const body = await request.json();
  const patientId: string | undefined = body.patientId;
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const { periodStart, periodEnd } = getShiftWindow(new Date());
  const tractionPullsYellow = coerceTelemetryCount(body.tractionPullsYellow);
  const tractionPullsRed = coerceTelemetryCount(body.tractionPullsRed);
  const adaptiveTractionAlert = coerceTelemetryBoolean(body.adaptiveTractionAlert);
  const dressingChanged = coerceTelemetryBoolean(body.dressingChanged);
  const catheterChanged = coerceTelemetryBoolean(body.catheterChanged);
  const flushingDone = coerceTelemetryBoolean(body.flushingDone);

  const recentShiftEvents = await db.shiftEvents.findFirst({
    where: {
      patientId,
      periodEnd: { gte: periodStart }
    },
    orderBy: { periodEnd: 'desc' }
  });

  const shiftEvents = recentShiftEvents
    ? await db.shiftEvents.update({
        where: { id: recentShiftEvents.id },
        data: {
          periodEnd,
          tractionPullsYellow: tractionPullsYellow ?? recentShiftEvents.tractionPullsYellow,
          tractionPullsRed: tractionPullsRed ?? recentShiftEvents.tractionPullsRed,
          dressingChanged: dressingChanged ?? recentShiftEvents.dressingChanged,
          catheterChanged: catheterChanged ?? recentShiftEvents.catheterChanged,
          flushingDone: flushingDone ?? recentShiftEvents.flushingDone,
          adaptiveTractionAlert: adaptiveTractionAlert ?? recentShiftEvents.adaptiveTractionAlert
        }
      })
    : await db.shiftEvents.create({
        data: {
          patientId,
          periodStart,
          periodEnd,
          tractionPullsYellow: tractionPullsYellow ?? 0,
          tractionPullsRed: tractionPullsRed ?? 0,
          dressingChanged: dressingChanged ?? false,
          catheterChanged: catheterChanged ?? false,
          flushingDone: flushingDone ?? false,
          adaptiveTractionAlert: adaptiveTractionAlert ?? false
        }
      });

  return NextResponse.json({ shiftEvents }, { status: 201 });
}
