import Link from 'next/link';
import PrivacyBanner from '@/components/PrivacyBanner';
import PageShell from '@/components/PageShell';

const features = [
  {
    title: 'CLISA-guided AI monitoring',
    detail: 'Gemini-powered scoring and camera captures deliver a bedside CLISA score every 12 hours.',
    badge: 'CLISA'
  },
  {
    title: 'Predictive risk + alerts',
    detail: 'Predictive CLABSI and venous trauma bands surface green / yellow / red actions before harm.',
    badge: 'Proactive'
  },
  {
    title: 'Ward analytics + audit trails',
    detail: 'Live CLABSI-per-1000 reporting, nursing checklist attestations, and patient privacy guardrails.',
    badge: 'Ward view'
  }
];

export default function HomePage() {
  return (
    <PageShell title="CathShield.ai" subtitle="Medical-grade mobile workflow">
      <div className="card space-y-4">
        <p className="text-base text-slate-600">
          Hospital teams use CathShield to capture, score, and escalate central line risks within a single blue-and-white bedside cockpit.
        </p>
        <PrivacyBanner />
        <div className="grid gap-3">
          <Link href="/patient" className="block w-full rounded-full bg-teal text-white text-center py-3 font-semibold">
            Begin Patient Identification
          </Link>
          <Link href="/dashboard" className="block w-full rounded-full border border-teal text-teal text-center py-3 font-semibold">
            View Patient Dashboard Demo
          </Link>
          <p className="text-xs text-slate-500 text-center">
            Workflow: Patient ID → Consent → 12-hour Capture → Dashboard → Alerts → Ward Analytics → Resources
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">CathShield feature stack</p>
        <div className="grid gap-3">
          {features.map((feature) => (
            <article key={feature.title} className="card border border-slate-100 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
                <span className="text-xs rounded-full bg-sky-50 text-sky-700 px-3 py-1">{feature.badge}</span>
              </div>
              <p className="text-sm text-slate-600">{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
