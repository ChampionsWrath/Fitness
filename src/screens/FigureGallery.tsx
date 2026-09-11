import { useEffect, useRef } from 'react';
import { FigureSvg } from '../figures/engine';
import { FIGURES } from '../figures/registry';
import { Screen } from '../components/ui';

/** Preview of every exercise animation. Add ?t=0.5 to the hash to freeze at a point in the loop. */
export function FigureGallery({ onBack }: { onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = Number(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('t') ?? 'NaN');
  useEffect(() => {
    if (Number.isNaN(t) || !ref.current) return;
    ref.current.querySelectorAll('svg').forEach((svg) => {
      const dur = Number(svg.dataset.dur ?? 2.6);
      svg.pauseAnimations();
      svg.setCurrentTime(dur * t);
    });
  }, [t]);
  return (
    <Screen title="Figures" onBack={onBack} noNav>
      <div ref={ref} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {Object.entries(FIGURES).map(([key, fig]) => (
          <div key={key} className="card flat" style={{ padding: 8 }}>
            <div className="fig-wrap" data-key={key}>
              <FigureSvg figure={fig} />
            </div>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              {key}
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
