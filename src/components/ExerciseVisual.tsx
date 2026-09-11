import { EXERCISE_MAP } from '../data/exercises';
import { FigureSvg } from '../figures/engine';
import { getFigure } from '../figures/registry';

export function ExerciseVisual({ exerciseId, size = 'lg', figureKey }: { exerciseId?: string; size?: 'sm' | 'md' | 'lg'; figureKey?: string }) {
  const key = figureKey ?? (exerciseId ? EXERCISE_MAP[exerciseId]?.figure : undefined) ?? 'bodyweight-squat';
  return (
    <div className={`fig-wrap ${size}`}>
      <FigureSvg figure={getFigure(key)} />
    </div>
  );
}
