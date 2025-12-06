type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export default function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <section className="w-full max-w-md mx-auto px-4 py-4 space-y-4">
      <header className="flex items-center justify-between bg-gradient-to-r from-medical to-medicalDark rounded-3xl shadow-card px-4 py-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/80">CathShield.ai</p>
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle ? <p className="text-sm text-white/80">{subtitle}</p> : null}
        </div>
        {actions ?? <span className="text-xs text-white/70">mobile care</span>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
