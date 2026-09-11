import { useMemo, useRef, useState } from 'react';
import type { Point } from '../lib/stats';
import { formatDate, parseISO } from '../lib/dates';

/**
 * Single-measure line chart: faint raw daily points + a 7-day trend line.
 * Optional goal line. Tap/drag shows a crosshair tooltip.
 */
export function LineChart({
  raw,
  trend,
  unit,
  goal,
  height = 220,
  rawLabel = 'Daily',
  trendLabel = '7-day trend',
}: {
  raw: Point[];
  trend: Point[];
  unit: string;
  goal?: number;
  height?: number;
  rawLabel?: string;
  trendLabel?: string;
}) {
  const W = 360;
  const H = height;
  const padL = 40;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const model = useMemo(() => {
    const all = [...raw].sort((a, b) => a.date.localeCompare(b.date));
    if (!all.length) return null;
    const t0 = parseISO(all[0].date).getTime();
    const t1 = Math.max(parseISO(all[all.length - 1].date).getTime(), t0 + 6 * 86400000);
    const vals = [...all.map((p) => p.value), ...trend.map((p) => p.value)];
    if (goal != null) vals.push(goal);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 4) {
      const mid = (hi + lo) / 2;
      lo = mid - 2;
      hi = mid + 2;
    }
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    const x = (date: string) => padL + ((parseISO(date).getTime() - t0) / (t1 - t0)) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const ticks = niceTicks(lo, hi, 4);
    const trendPts = trend.map((p) => ({ ...p, px: x(p.date), py: y(p.value) }));
    const rawPts = all.map((p) => ({ ...p, px: x(p.date), py: y(p.value) }));
    const line = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
    const area = trendPts.length
      ? `${line} L${trendPts[trendPts.length - 1].px.toFixed(1)},${(H - padB).toFixed(1)} L${trendPts[0].px.toFixed(1)},${(H - padB).toFixed(1)} Z`
      : '';
    const xTicks: { px: number; label: string }[] = [];
    const span = t1 - t0;
    const n = span > 120 * 86400000 ? 4 : 3;
    for (let i = 0; i <= n; i++) {
      const t = t0 + (span * i) / n;
      const d = new Date(t);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      xTicks.push({ px: x(iso), label: formatDate(iso) });
    }
    return { rawPts, trendPts, line, area, ticks, y, xTicks, goalY: goal != null ? y(goal) : null };
  }, [raw, trend, goal, H]);

  if (!model) return null;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    model.rawPts.forEach((p, i) => {
      const d = Math.abs(p.px - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const h = hover != null ? model.rawPts[hover] : null;
  const hTrend = h ? model.trendPts.find((p) => p.date === h.date) : null;

  return (
    <div>
      <svg
        ref={svgRef}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointer}
        onPointerMove={(e) => e.buttons && onPointer(e)}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${trendLabel} chart`}
      >
        {model.ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={W - padR} y1={model.y(t)} y2={model.y(t)} />
            <text className="axis-text" x={padL - 6} y={model.y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {model.xTicks.map((t, i) => (
          <text key={i} className="axis-text" x={t.px} y={H - 8} textAnchor={i === 0 ? 'start' : i === model.xTicks.length - 1 ? 'end' : 'middle'}>
            {t.label}
          </text>
        ))}
        {model.goalY != null && <line className="goal" x1={padL} x2={W - padR} y1={model.goalY} y2={model.goalY} />}
        {model.area && <path className="area" d={model.area} />}
        {model.rawPts.map((p) => (
          <circle key={p.date} className="raw" cx={p.px} cy={p.py} r={2.5} />
        ))}
        {model.line && <path className="line" d={model.line} />}
        {model.trendPts.length > 0 && (
          <circle className="dot" cx={model.trendPts[model.trendPts.length - 1].px} cy={model.trendPts[model.trendPts.length - 1].py} r={4.5} />
        )}
        {h && (
          <g>
            <line className="cross" x1={h.px} x2={h.px} y1={padT} y2={H - padB} />
            <circle className="dot" cx={h.px} cy={h.py} r={4} />
            <text className="tip" x={h.px} y={padT - 4} textAnchor={h.px > W - 90 ? 'end' : h.px < padL + 60 ? 'start' : 'middle'}>
              {formatDate(h.date)} · {h.value} {unit}
              {hTrend ? ` · trend ${hTrend.value.toFixed(1)}` : ''}
            </text>
          </g>
        )}
      </svg>
      <div className="legend">
        <span>
          <i className="raw" />
          {rawLabel}
        </span>
        <span>
          <i />
          {trendLabel}
        </span>
        {goal != null && (
          <span>
            <i className="goal" />
            Goal
          </span>
        )}
      </div>
    </div>
  );
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  const rough = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi; v += step) out.push(Number(v.toFixed(2)));
  return out;
}
