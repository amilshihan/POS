"use client";

// Lightweight, dependency-free charts for the Reports page.
// Sequential blue ramp only (magnitude comparisons / trends) — see the
// dataviz skill: sequential is the safe default outside identity/polarity.
const BLUE = "#2a78d6";
const BLUE_WASH = "rgba(42, 120, 214, 0.1)";
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const TEXT_SECONDARY = "#52514e";
const TEXT_MUTED = "#898781";

function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toFixed(0);
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function BarChart({
  data,
  valueLabel = (v: number) => compactNumber(v),
  height,
}: {
  data: { label: string; value: number }[];
  valueLabel?: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-8">No data for this selection.</div>;
  }
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const barThickness = 22;
  const gap = 10;
  const rowHeight = barThickness + gap;
  const labelWidth = 140;
  const chartWidth = 560;
  const plotWidth = chartWidth - labelWidth - 50;
  const svgHeight = height ?? data.length * rowHeight + 10;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${svgHeight}`} className="w-full" style={{ height: svgHeight }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={labelWidth + plotWidth * f}
          x2={labelWidth + plotWidth * f}
          y1={0}
          y2={svgHeight - 10}
          stroke={GRID}
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const y = i * rowHeight;
        const w = max > 0 ? (d.value / max) * plotWidth : 0;
        return (
          <g key={d.label + i}>
            <title>
              {d.label}: {valueLabel(d.value)}
            </title>
            <text
              x={labelWidth - 10}
              y={y + barThickness / 2 + 4}
              textAnchor="end"
              fontSize={12}
              fill={TEXT_SECONDARY}
            >
              {d.label.length > 22 ? d.label.slice(0, 21) + "…" : d.label}
            </text>
            <rect x={labelWidth} y={y} width={Math.max(w, 2)} height={barThickness} rx={4} fill={BLUE} />
            <text
              x={labelWidth + Math.max(w, 2) + 6}
              y={y + barThickness / 2 + 4}
              fontSize={12}
              fill={TEXT_SECONDARY}
              fontWeight={600}
            >
              {valueLabel(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({
  data,
  valueLabel = (v: number) => compactNumber(v),
  height = 220,
}: {
  data: { label: string; value: number }[];
  valueLabel?: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-8">No data for this selection.</div>;
  }
  const width = 760;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const min = Math.min(0, Math.min(...data.map((d) => d.value)));
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
    const y = padTop + plotHeight - ((d.value - min) / range) * plotHeight;
    return { x, y, ...d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const zeroY = padTop + plotHeight - ((0 - min) / range) * plotHeight;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => min + (range * i) / tickCount);

  const xLabelStep = Math.max(1, Math.ceil(data.length / 7));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {ticks.map((t, i) => {
        const y = padTop + plotHeight - ((t - min) / range) * plotHeight;
        return (
          <g key={i}>
            <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize={11} fill={TEXT_MUTED}>
              {valueLabel(t)}
            </text>
          </g>
        );
      })}
      <line x1={padLeft} x2={width - padRight} y1={zeroY} y2={zeroY} stroke={AXIS} strokeWidth={1} />
      <path d={areaPath} fill={BLUE_WASH} stroke="none" />
      <path d={linePath} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <title>
            {p.label}: {valueLabel(p.value)}
          </title>
          <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
          {(i === points.length - 1 || i % Math.ceil(points.length / 20 || 1) === 0) && (
            <circle cx={p.x} cy={p.y} r={4} fill={BLUE} stroke="#fff" strokeWidth={2} />
          )}
          {i % xLabelStep === 0 && (
            <text x={p.x} y={height - 6} textAnchor="middle" fontSize={10} fill={TEXT_MUTED}>
              {p.label}
            </text>
          )}
        </g>
      ))}
      {points.length > 0 && (
        <text
          x={points[points.length - 1].x}
          y={points[points.length - 1].y - 10}
          textAnchor="end"
          fontSize={12}
          fontWeight={600}
          fill={TEXT_SECONDARY}
        >
          {valueLabel(points[points.length - 1].value)}
        </text>
      )}
    </svg>
  );
}
