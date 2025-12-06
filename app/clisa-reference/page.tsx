import Link from 'next/link';
import PageShell from '@/components/PageShell';

const rows = [
  {
    score: '0-1',
    appearance: 'Clean site, transparent dressing intact, no erythema or ooze',
    action: 'Routine care; re-assess in 12 hours; maintain sterile caps'
  },
  {
    score: '2-3',
    appearance: 'Mild erythema, scant serous ooze, early moisture under dressing',
    action: 'Reinforce dressing, document traction pulls, and re-image at next shift'
  },
  {
    score: '4+',
    appearance: 'Significant drainage, maceration, device lift or visible infection',
    action: 'Replace dressing, escalate to medical officer, prepare for line change'
  }
];

export default function ClisaReferencePage() {
  return (
    <PageShell title="CLISA Reference Table" subtitle="Central Line Insertion Site Assessment">
      <section className="card space-y-3">
        <p className="text-sm text-slate-600">
          Use this table to mirror what CathShield displays on the dashboard. Scores are color-coded: green (0-1) for intact
          sites, yellow (2-3) for early tissue change, and red (4+) when venous resistance / CLABSI-critical cues appear.
        </p>
        <p className="text-xs text-slate-500">
          Guidance aligns with the content-validated CathShield safety index (SCVI ≥ .82, Cronbach&apos;s α = .82) and local CLABSI
          escalation policies. Document every action in the EHR after completing the bedside intervention.
        </p>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
          {rows.map((row) => (
            <article key={row.score} className="p-3 space-y-1 bg-white">
              <p className="text-xs uppercase tracking-wide text-slate-400">Score {row.score}</p>
              <p className="text-base font-semibold text-slate-900">{row.appearance}</p>
              <p className="text-sm text-teal font-semibold">{row.action}</p>
            </article>
          ))}
        </div>
        <Link href="/dashboard" className="text-xs text-teal underline">
          Return to patient dashboard
        </Link>
      </section>
    </PageShell>
  );
}
