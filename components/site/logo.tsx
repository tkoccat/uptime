// Logo işareti: yuvarlatılmış kare içinde "nabız halkası" (izleme + canlılık). Favicon ile aynı çizim.
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <circle cx="16" cy="16" r="8" fill="none" strokeWidth="2.6" className="stroke-primary-foreground" strokeDasharray="38 12" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.8" className="fill-primary-foreground" />
    </svg>
  );
}
