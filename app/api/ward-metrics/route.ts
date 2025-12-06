import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const computeDelta = (list: { derivedRate: number }[]) => {
  if (list.length < 2) return 0;
  const latest = list[0];
  const older = list[list.length - 1];
  if (!older.derivedRate) {
    return 0;
  }
  return ((latest.derivedRate - older.derivedRate) / older.derivedRate) * 100;
};

export async function GET() {
  const metrics = await db.wardMetrics.findMany({
    orderBy: { date: 'desc' },
    take: 30
  });
  if (!metrics.length) {
    return NextResponse.json({ metrics: [], delta: 0 });
  }
  const delta = computeDelta(metrics);
  return NextResponse.json({ metrics, delta });
}
