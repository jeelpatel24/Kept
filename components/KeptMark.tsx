// The mark: a physical key tile with the check debossed into it. The blue dot is the record light.
// From the prototype brand sheet. Pure SVG — no external assets.

export function KeptTile({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden focusable="false">
      <rect x="1" y="1" width="32" height="32" rx="9" fill="#1b2430" />
      <rect x="1" y="1" width="32" height="32" rx="9" fill="none" stroke="rgba(255,255,255,0.08)" />
      <path d="M10 17.5 L15 22.5 L24.5 12.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26.5" cy="25.5" r="3" fill="#1f5fe0" />
    </svg>
  );
}

export function KeptWordmark({ tile = 30, className = "" }: { tile?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <KeptTile size={tile} />
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Kept<span className="text-accent">.</span>
      </span>
    </span>
  );
}
