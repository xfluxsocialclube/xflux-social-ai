/** Mascote FLUX: robô original, desenhado em SVG, com um X destacado no peito. */
export function FluxMascot({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="FLUX">
      <defs>
        <linearGradient id="fx-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3f7a" /><stop offset="1" stopColor="#1d2048" />
        </linearGradient>
        <linearGradient id="fx-x" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cff" /><stop offset="1" stopColor="#3da9ff" />
        </linearGradient>
        <filter id="fx-glow"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <line x1="80" y1="14" x2="80" y2="30" stroke="#6f7bff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="12" r="5" fill="#3da9ff" />
      <rect x="40" y="30" width="80" height="58" rx="22" fill="url(#fx-body)" stroke="#6f7bff" strokeWidth="2" />
      <rect x="50" y="42" width="60" height="32" rx="14" fill="#0d1030" />
      <circle cx="68" cy="58" r="7" fill="#3da9ff" /><circle cx="92" cy="58" r="7" fill="#3da9ff" />
      <circle cx="70" cy="56" r="2" fill="#fff" /><circle cx="94" cy="56" r="2" fill="#fff" />
      <path d="M72 68 Q80 73 88 68" stroke="#8b5cff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="48" y="94" width="64" height="48" rx="16" fill="url(#fx-body)" stroke="#6f7bff" strokeWidth="2" />
      <g filter="url(#fx-glow)" opacity="0.7">
        <path d="M68 104 L92 132 M92 104 L68 132" stroke="url(#fx-x)" strokeWidth="9" strokeLinecap="round" />
      </g>
      <path d="M68 104 L92 132 M92 104 L68 132" stroke="url(#fx-x)" strokeWidth="7" strokeLinecap="round" />
      <rect x="26" y="98" width="16" height="30" rx="8" fill="#2a2e63" stroke="#6f7bff" strokeWidth="2" />
      <rect x="118" y="98" width="16" height="30" rx="8" fill="#2a2e63" stroke="#6f7bff" strokeWidth="2" />
    </svg>
  );
}
