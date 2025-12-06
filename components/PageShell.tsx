type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export default function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <section className="w-full max-w-md mx-auto px-4 py-4 space-y-4">
      <header className="flex items-center justify-between bg-white/90 backdrop-blur rounded-3xl shadow-card px-4 py-4 border border-white/60">
        <div>
          <p className="text-xs uppercase tracking-wide text-medical">CathShield.ai</p>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ?? (
          <span className="text-xs text-medicalDark/70 bg-skyglass/70 px-3 py-1 rounded-full">mobile care</span>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
