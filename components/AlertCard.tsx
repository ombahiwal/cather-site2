type Props = {
  title: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  acknowledged: boolean;
  recommendedAction: string;
  onAcknowledge?: () => void;
};

const severityTone: Record<Props['severity'], string> = {
  info: 'bg-skyglass text-medicalDark border border-medical/20',
  warning: 'bg-risk-yellow/10 text-risk-yellow border border-risk-yellow/20',
  critical: 'bg-risk-red/10 text-risk-red border border-risk-red/20'
};

export default function AlertCard({
  title,
  reason,
  severity,
  timestamp,
  acknowledged,
  recommendedAction,
  onAcknowledge
}: Props) {
  return (
    <article className="card">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${severityTone[severity]}`}>{severity.toUpperCase()}</span>
      </div>
      <p className="text-sm text-slate-700">{reason}</p>
      <p className="text-xs text-slate-500">{new Date(timestamp).toLocaleString()}</p>
      <div className="bg-slate-50 rounded-2xl px-3 py-2 border border-slate-100">
        <p className="text-xs uppercase tracking-wide text-slate-500">Recommended action</p>
        <p className="text-sm font-semibold">{recommendedAction}</p>
      </div>
      <button
        type="button"
        className="w-full rounded-full bg-medical text-white py-2 text-sm font-semibold hover:bg-medicalDark transition"
        onClick={onAcknowledge}
        disabled={acknowledged}
      >
        {acknowledged ? 'Acknowledged' : 'Mark as acknowledged'}
      </button>
    </article>
  );
}
