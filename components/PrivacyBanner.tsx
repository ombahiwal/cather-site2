export default function PrivacyBanner() {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 shadow-card">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-medical">PaCEN privacy lock:</span> patient identity, consent audio, and catheter captures remain encrypted within the hospital network and are only surfaced for bedside safety tasks.
      </p>
    </div>
  );
}
