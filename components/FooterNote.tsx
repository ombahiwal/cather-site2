export default function FooterNote() {
  return (
    <footer className="px-4 py-3 bg-gradient-to-r from-skyglass to-white text-xs text-slate-600 text-center border-t border-white/40 space-y-1">
      <p>
        &ldquo;The safety indexes in this system are content-validated by existing research and clinicians (SCVI &ge; .82, Cronbach&rsquo;s &alpha; = .82) and continue to be externally validated over time.&rdquo;
      </p>
      <p className="text-[11px] text-slate-500">
        CathShield.ai is a decision-support prototype. Always follow the hospital CLABSI bundle, physician orders, and local
        escalation pathways; do not delay emergency care while using this tool.
      </p>
    </footer>
  );
}
