type Props = {
  band: 'green' | 'yellow' | 'red';
  action: string;
  title?: string;
};

const bgMap = {
  green: 'bg-risk-green/10 text-risk-green',
  yellow: 'bg-risk-yellow/10 text-risk-yellow',
  red: 'bg-risk-red/10 text-risk-red'
};

const frameMap = {
  green: 'border border-risk-green/30',
  yellow: 'border border-risk-yellow/30',
  red: 'border border-risk-red/30'
};

export default function RecommendedActionCard({ band, action, title = 'Recommended action' }: Props) {
  return (
    <div className={`card ${bgMap[band]} ${frameMap[band]}`}>
      <p className="text-xs uppercase tracking-wide">{title}</p>
      <p className="text-xs font-semibold text-slate-500">Risk band: {band.toUpperCase()}</p>
      <p className="text-base font-semibold">{action}</p>
    </div>
  );
}
