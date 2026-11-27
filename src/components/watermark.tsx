/** Repeating diagonal text over content so any leaked screenshot shows who it came from. */
export function Watermark({ text, opacity = 0.14 }: { text: string; opacity?: number }) {
  const rows = Array.from({ length: 8 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{ opacity }}>
      <div className="absolute -inset-1/2 flex rotate-[-25deg] flex-col justify-around">
        {rows.map((_, i) => (
          <div key={i} className="flex justify-around whitespace-nowrap text-lg font-bold text-slate-900" style={{ marginInlineStart: i % 2 ? "8rem" : 0 }}>
            <span>{text}</span><span>{text}</span><span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
