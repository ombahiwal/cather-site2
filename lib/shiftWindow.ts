const SHIFT_WINDOW_HOURS = 12;
export const SHIFT_WINDOW_MS = SHIFT_WINDOW_HOURS * 60 * 60 * 1000;

export const getShiftWindow = (reference: Date = new Date()) => {
  const periodEnd = reference;
  const periodStart = new Date(periodEnd.getTime() - SHIFT_WINDOW_MS);
  return { periodStart, periodEnd };
};

export const coerceTelemetryCount = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return undefined;
};

export const coerceTelemetryBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};
