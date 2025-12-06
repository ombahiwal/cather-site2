export type RiskThresholds = {
  greenMax: number;
  yellowMax: number;
};

const defaultThresholds: RiskThresholds = {
  greenMax: 3,
  yellowMax: 6
};

let cached: RiskThresholds | null = null;

const isValidThresholds = (value: any): value is RiskThresholds => {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.greenMax !== 'number' || typeof value.yellowMax !== 'number') return false;
  return value.greenMax < value.yellowMax;
};

export const getRiskThresholds = (): RiskThresholds => {
  if (cached) return cached;
  const raw = process.env.RISK_BAND_THRESHOLDS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidThresholds(parsed)) {
        cached = parsed;
        return cached;
      }
    } catch (error) {
      console.warn('Invalid RISK_BAND_THRESHOLDS env, using defaults');
    }
  }
  cached = defaultThresholds;
  return cached;
};
