/** The platform logo: three rising steps with a gold arrow ("steps to the solution"). */
export default function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="10" y="62" width="22" height="22" rx="5" fill="currentColor" />
      <rect x="39" y="40" width="22" height="44" rx="5" fill="currentColor" />
      <rect x="68" y="18" width="22" height="66" rx="5" fill="currentColor" />
      <path d="M14 50 L44 24 L60 34 L88 8" fill="none" stroke="#e0a526" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 8 H88 V20" fill="none" stroke="#e0a526" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
