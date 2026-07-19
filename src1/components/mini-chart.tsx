export function MiniBarChart({
  data,
  labels,
  height = 60,
  color = "var(--color-primary)",
}: {
  data: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data);
  const w = 100;
  const barW = w / data.length;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
        {data.map((v, i) => {
          const h = (v / max) * (height - 8);
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.15}
              y={height - h}
              width={barW * 0.7}
              height={h}
              rx={1.2}
              fill={color}
              opacity={0.7 + (v / max) * 0.3}
            />
          );
        })}
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
