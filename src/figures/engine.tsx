import { useEffect, useMemo, useState } from 'react';

export type Pt = [number, number];

/**
 * A pose is a set of joint positions in a 240x200 viewBox.
 * Side view: `shoulder/elbow/hand/knee/ankle/foot` are the NEAR limbs,
 * the `*2` variants are the FAR limbs (drawn behind, slightly faded).
 * Front view: `*` = viewer's left, `*2` = viewer's right, equal opacity.
 */
export interface Pose {
  head: Pt;
  neck: Pt;
  hip: Pt;
  shoulder: Pt;
  elbow: Pt;
  hand: Pt;
  knee: Pt;
  ankle: Pt;
  foot: Pt;
  shoulder2?: Pt;
  elbow2?: Pt;
  hand2?: Pt;
  knee2?: Pt;
  ankle2?: Pt;
  foot2?: Pt;
}

export type Item =
  | { kind: 'dumbbell'; at: 'hand' | 'hand2' | 'both'; orient: 'h' | 'v' | 'forearm'; size?: number }
  | { kind: 'bar'; from: 'hand'; to: 'hand2'; cable?: Pt }
  | { kind: 'band'; anchor: Pt; to: ('hand' | 'hand2' | 'foot' | 'foot2')[] };

export type Prop =
  | { kind: 'floor' }
  | { kind: 'bench'; x: number; y: number; w: number }
  | { kind: 'incline-bench'; x: number; y: number }
  | { kind: 'treadmill' }
  | { kind: 'pullup-bar'; y: number }
  | { kind: 'pulldown'; y: number }
  | { kind: 'anchor'; at: Pt };

export interface Figure {
  view: 'side' | 'front';
  poses: Pose[];
  /** seconds for one full loop */
  dur?: number;
  /** if true, poses loop A->B->A with short holds; otherwise sequential loop */
  pingPong?: boolean;
  items?: Item[];
  props?: Prop[];
  /** near-limb draw order: 'arm-front' draws arm above torso (default) */
  armBehind?: boolean;
}

const HEAD_R = 11;

function pts(points: Pt[]): string {
  return points.map((p) => `${p[0]},${p[1]}`).join(' ');
}

function buildFrames(fig: Figure): { frames: Pose[]; keyTimes: string } {
  const p = fig.poses;
  if (p.length === 1) return { frames: [p[0], p[0]], keyTimes: '0;1' };
  if (fig.pingPong !== false && p.length === 2) {
    // A hold, move to B, hold, move back
    return { frames: [p[0], p[0], p[1], p[1], p[0]], keyTimes: '0;0.08;0.5;0.58;1' };
  }
  if (fig.pingPong && p.length > 2) {
    const seq = [...p, ...p.slice(0, -1).reverse()];
    const n = seq.length - 1;
    return { frames: seq, keyTimes: seq.map((_, i) => (i / n).toFixed(3)).join(';') };
  }
  const seq = [...p, p[0]];
  const n = seq.length - 1;
  return { frames: seq, keyTimes: seq.map((_, i) => (i / n).toFixed(3)).join(';') };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (!('matchMedia' in window)) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

interface AnimProps {
  attr: string;
  values: string[];
  keyTimes: string;
  dur: number;
  animate: boolean;
}

function Anim({ attr, values, keyTimes, dur, animate }: AnimProps) {
  if (!animate) return null;
  return (
    <animate
      attributeName={attr}
      values={values.join(';')}
      keyTimes={keyTimes}
      dur={`${dur}s`}
      repeatCount="indefinite"
      calcMode="spline"
      keySplines={Array(values.length - 1)
        .fill('0.42 0 0.58 1')
        .join(';')}
    />
  );
}

function Limb({
  frames,
  keys,
  keyTimes,
  dur,
  animate,
  className,
}: {
  frames: Pose[];
  keys: (keyof Pose)[];
  keyTimes: string;
  dur: number;
  animate: boolean;
  className: string;
}) {
  if (keys.some((k) => !frames[0][k])) return null;
  const values = frames.map((f) => pts(keys.map((k) => f[k] as Pt)));
  return (
    <polyline className={className} points={values[0]}>
      <Anim attr="points" values={values} keyTimes={keyTimes} dur={dur} animate={animate} />
    </polyline>
  );
}

function Dumbbell({
  frames,
  keyTimes,
  dur,
  animate,
  at,
  orient,
  size = 1,
}: {
  frames: Pose[];
  keyTimes: string;
  dur: number;
  animate: boolean;
  at: 'hand' | 'hand2';
  orient: 'h' | 'v' | 'forearm';
  size?: number;
}) {
  if (!frames[0][at]) return null;
  const elbowKey = at === 'hand' ? 'elbow' : 'elbow2';
  const trans = frames.map((f) => `${f[at]![0]} ${f[at]![1]}`);
  const rots = frames.map((f) => {
    if (orient === 'h') return '0';
    if (orient === 'v') return '90';
    const e = f[elbowKey] as Pt;
    const h = f[at] as Pt;
    const ang = (Math.atan2(h[1] - e[1], h[0] - e[0]) * 180) / Math.PI + 90;
    return ang.toFixed(1);
  });
  const L = 22 * size;
  const r = 5 * size;
  return (
    <g transform={`translate(${trans[0]})`}>
      {animate && (
        <animateTransform
          attributeName="transform"
          type="translate"
          values={trans.join(';')}
          keyTimes={keyTimes}
          dur={`${dur}s`}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={Array(trans.length - 1)
            .fill('0.42 0 0.58 1')
            .join(';')}
        />
      )}
      <g transform={`rotate(${rots[0]})`} className="fig-db">
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={rots.join(';')}
            keyTimes={keyTimes}
            dur={`${dur}s`}
            repeatCount="indefinite"
          />
        )}
        <line x1={-L / 2} y1={0} x2={L / 2} y2={0} className="fig-db-bar" />
        <rect x={-L / 2 - 3} y={-r} width={6} height={r * 2} rx={1.5} className="fig-db-plate" />
        <rect x={L / 2 - 3} y={-r} width={6} height={r * 2} rx={1.5} className="fig-db-plate" />
      </g>
    </g>
  );
}

function Props({ props }: { props: Prop[] }) {
  return (
    <g className="fig-props">
      {props.map((p, i) => {
        switch (p.kind) {
          case 'floor':
            return <line key={i} x1={20} y1={171} x2={220} y2={171} className="fig-floor" />;
          case 'bench':
            return (
              <g key={i}>
                <rect x={p.x} y={p.y} width={p.w} height={9} rx={3} className="fig-bench" />
                <line x1={p.x + 14} y1={p.y + 9} x2={p.x + 14} y2={171} className="fig-bench-leg" />
                <line x1={p.x + p.w - 14} y1={p.y + 9} x2={p.x + p.w - 14} y2={171} className="fig-bench-leg" />
                <line x1={20} y1={171} x2={220} y2={171} className="fig-floor" />
              </g>
            );
          case 'incline-bench':
            return (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={p.x + 58} y2={p.y - 58} className="fig-bench-pad" />
                <line x1={p.x} y1={p.y + 2} x2={p.x + 40} y2={p.y + 2} className="fig-bench-pad" />
                <line x1={p.x + 20} y1={p.y + 6} x2={p.x + 20} y2={171} className="fig-bench-leg" />
                <line x1={20} y1={171} x2={220} y2={171} className="fig-floor" />
              </g>
            );
          case 'treadmill':
            return (
              <g key={i}>
                <rect x={40} y={172} width={160} height={9} rx={4} className="fig-bench" />
                <line x1={48} y1={176.5} x2={192} y2={176.5} className="fig-belt">
                  <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.8s" repeatCount="indefinite" />
                </line>
                <line x1={196} y1={176} x2={206} y2={96} className="fig-bench-leg" />
                <rect x={196} y={90} width={26} height={9} rx={3} className="fig-bench" />
                <line x1={206} y1={99} x2={186} y2={112} className="fig-bench-leg" />
              </g>
            );
          case 'pullup-bar':
            return (
              <g key={i}>
                <line x1={60} y1={p.y} x2={180} y2={p.y} className="fig-bar" />
                <line x1={60} y1={p.y} x2={60} y2={p.y - 14} className="fig-bench-leg" />
                <line x1={180} y1={p.y} x2={180} y2={p.y - 14} className="fig-bench-leg" />
              </g>
            );
          case 'pulldown':
            return (
              <g key={i}>
                <line x1={20} y1={171} x2={220} y2={171} className="fig-floor" />
                <line x1={120} y1={6} x2={120} y2={p.y} className="fig-cable" />
                <rect x={92} y={128} width={56} height={8} rx={3} className="fig-bench" />
                <line x1={120} y1={136} x2={120} y2={171} className="fig-bench-leg" />
              </g>
            );
          case 'anchor':
            return <circle key={i} cx={p.at[0]} cy={p.at[1]} r={4} className="fig-anchor" />;
        }
      })}
    </g>
  );
}

export function FigureSvg({ figure, className }: { figure: Figure; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const animate = !reduced;
  const { frames, keyTimes } = useMemo(() => buildFrames(figure), [figure]);
  const dur = figure.dur ?? 2.6;
  const near = figure.view === 'side' ? 'fig-limb near' : 'fig-limb';
  const far = figure.view === 'side' ? 'fig-limb far' : 'fig-limb';
  const common = { frames, keyTimes, dur, animate };

  const headX = frames.map((f) => String(f.head[0]));
  const headY = frames.map((f) => String(f.head[1]));

  const items = figure.items ?? [];
  const bar = items.find((i) => i.kind === 'bar');
  const band = items.find((i) => i.kind === 'band');

  const armFront = (
    <>
      <Limb {...common} keys={['shoulder', 'elbow', 'hand']} className={near} />
    </>
  );

  return (
    <svg
      viewBox="0 0 240 200"
      data-dur={dur}
      className={`fig ${className ?? ''}`}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {figure.props && <Props props={figure.props} />}
      {band &&
        band.to.map((k) => {
          const vals = frames.map((f) => pts([band.anchor, (f[k] as Pt) ?? band.anchor]));
          return (
            <polyline key={k} className="fig-band" points={vals[0]}>
              <Anim attr="points" values={vals} keyTimes={keyTimes} dur={dur} animate={animate} />
            </polyline>
          );
        })}
      {/* far limbs */}
      <Limb {...common} keys={['shoulder2', 'elbow2', 'hand2']} className={far} />
      <Limb {...common} keys={['hip', 'knee2', 'ankle2', 'foot2']} className={far} />
      {items
        .filter((i) => i.kind === 'dumbbell' && (i.at === 'hand2' || i.at === 'both'))
        .map((i, idx) =>
          i.kind === 'dumbbell' ? (
            <Dumbbell key={`d2${idx}`} {...common} at="hand2" orient={i.orient} size={i.size} />
          ) : null,
        )}
      {/* torso */}
      <Limb {...common} keys={['neck', 'hip']} className="fig-torso" />
      {/* near leg */}
      <Limb {...common} keys={['hip', 'knee', 'ankle', 'foot']} className={near} />
      {figure.armBehind && armFront}
      <circle className="fig-head" cx={frames[0].head[0]} cy={frames[0].head[1]} r={HEAD_R}>
        <Anim attr="cx" values={headX} keyTimes={keyTimes} dur={dur} animate={animate} />
        <Anim attr="cy" values={headY} keyTimes={keyTimes} dur={dur} animate={animate} />
      </circle>
      {!figure.armBehind && armFront}
      {bar && (
        <>
          {bar.cable && (
            <polyline
              className="fig-cable"
              points={pts([
                bar.cable,
                [(frames[0].hand[0] + (frames[0].hand2?.[0] ?? 0)) / 2, (frames[0].hand[1] + (frames[0].hand2?.[1] ?? 0)) / 2],
              ])}
            >
              <Anim
                attr="points"
                values={frames.map((f) =>
                  pts([bar.cable!, [(f.hand[0] + f.hand2![0]) / 2, (f.hand[1] + f.hand2![1]) / 2]]),
                )}
                keyTimes={keyTimes}
                dur={dur}
                animate={animate}
              />
            </polyline>
          )}
          <polyline className="fig-bar" points={pts([frames[0].hand, frames[0].hand2!])}>
            <Anim
              attr="points"
              values={frames.map((f) => {
                const a = f.hand;
                const b = f.hand2!;
                const dx = b[0] - a[0];
                const dy = b[1] - a[1];
                const len = Math.hypot(dx, dy) || 1;
                const ex = (dx / len) * 14;
                const ey = (dy / len) * 14;
                return pts([
                  [a[0] - ex, a[1] - ey],
                  [b[0] + ex, b[1] + ey],
                ]);
              })}
              keyTimes={keyTimes}
              dur={dur}
              animate={animate}
            />
          </polyline>
        </>
      )}
      {items
        .filter((i) => i.kind === 'dumbbell' && (i.at === 'hand' || i.at === 'both'))
        .map((i, idx) =>
          i.kind === 'dumbbell' ? (
            <Dumbbell key={`d1${idx}`} {...common} at="hand" orient={i.orient} size={i.size} />
          ) : null,
        )}
    </svg>
  );
}
