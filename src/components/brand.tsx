/**
 * The platform name with its main part emphasized: "خوارزميات البسيوني في الرياضيات"
 * shows "خوارزميات البسيوني" large and bold and "في الرياضيات" smaller.
 * The split is at the first " في "; a name without it shows as is.
 */
export function splitBrand(name: string) {
  const i = name.indexOf(" في ");
  return i > 0 ? { main: name.slice(0, i), tagline: name.slice(i + 1) } : { main: name, tagline: "" };
}

export default function Brand({ name, stacked = false, className = "" }: { name: string; stacked?: boolean; className?: string }) {
  const { main, tagline } = splitBrand(name);
  if (stacked) {
    return (
      <span className={`flex flex-col items-center leading-tight md:items-start ${className}`}>
        <span className="text-2xl font-bold text-blue-900 md:text-3xl">{main}</span>{" "}
        {tagline && <span className="mt-3 text-sm font-medium text-slate-500">{tagline}</span>}
      </span>
    );
  }
  return (
    <span className={`flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1.5 leading-tight ${className}`}>
      <span className="whitespace-nowrap text-base font-bold text-blue-900 sm:text-lg">{main}</span>{" "}
      {tagline && <span className="whitespace-nowrap text-[11px] font-medium text-slate-500 sm:text-xs">{tagline}</span>}
    </span>
  );
}
