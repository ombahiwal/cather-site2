export default function PrivacyBanner() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-teal">PaCEN privacy lock:</span> patient identity, consent audio, and catheter captures remain encrypted within the hospital network and are only surfaced for bedside safety tasks.
      </p>
    </div>
  );
}
