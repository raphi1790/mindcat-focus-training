import type { DaySummary, TrainingSummary } from '../trainingSummary';
import { CHART_COLORS, niceMax, roundedTopBarPath } from './chartTheme';
import DataTable from './DataTable';

/**
 * Trainingsverlauf über 5 Tage (Plan §5.3 Punkt 2, analog Studie Tabelle 1):
 * vier Small-Multiples statt einem Dual-Achsen-Chart — jede Metrik hat eine
 * eigene Skala.
 */

const WIDTH = 260;
const HEIGHT = 130;
const PAD_LEFT = 30;
const PAD_RIGHT = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const BASELINE_Y = PAD_TOP + PLOT_HEIGHT;

interface Point {
  day: number;
  value: number;
}

function MiniPanel({
  title,
  unitLabel,
  points,
  variant,
}: {
  title: string;
  unitLabel: string;
  points: Point[];
  variant: 'bar' | 'line';
}) {
  const maxValue = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const slotWidth = PLOT_WIDTH / Math.max(1, points.length);
  const xFor = (i: number) => PAD_LEFT + slotWidth * (i + 0.5);
  const yFor = (v: number) => BASELINE_Y - (v / maxValue) * PLOT_HEIGHT;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <h4 className="text-sm font-bold text-slate-700 mb-1">{title}</h4>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}: ${points.map((p) => `Tag ${p.day} ${Math.round(p.value * 10) / 10}${unitLabel}`).join(', ')}`}
        className="w-full h-auto"
      >
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={BASELINE_Y} y2={BASELINE_Y} stroke={CHART_COLORS.axis} strokeWidth={1} />
        <text x={PAD_LEFT - 6} y={PAD_TOP + 4} textAnchor="end" fontSize={9} fill={CHART_COLORS.inkMuted}>
          {Math.round(maxValue)}
        </text>

        {variant === 'bar' &&
          points.map((p, i) => {
            const barWidth = Math.min(22, slotWidth - 8);
            const x = xFor(i) - barWidth / 2;
            const y = yFor(p.value);
            return (
              <path key={p.day} d={roundedTopBarPath(x, y, barWidth, BASELINE_Y - y)} fill={CHART_COLORS.seriesBlue} />
            );
          })}

        {variant === 'line' && points.length > 0 && (
          <path
            d={points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.value)}`).join(' ')}
            fill="none"
            stroke={CHART_COLORS.seriesBlue}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {variant === 'line' &&
          points.map((p, i) => (
            <circle key={p.day} cx={xFor(i)} cy={yFor(p.value)} r={4} fill={CHART_COLORS.seriesBlue} stroke={CHART_COLORS.surface} strokeWidth={2} />
          ))}

        {points.map((p, i) => (
          <text key={p.day} x={xFor(i)} y={HEIGHT - 6} textAnchor="middle" fontSize={9} fill={CHART_COLORS.inkMuted}>
            T{p.day}
          </text>
        ))}
      </svg>
    </div>
  );
}

function toPoints(days: readonly DaySummary[], select: (d: DaySummary) => number): Point[] {
  return days.map((d) => ({ day: d.sessionDay, value: select(d) }));
}

export default function TrainingProgressChart({ summary }: { summary: TrainingSummary }) {
  if (summary.days.length === 0) {
    return <p className="text-slate-400 text-sm">Noch keine Trainingsdaten vorhanden.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniPanel
          title="Abgeschlossene Übungen"
          unitLabel=""
          points={toPoints(summary.days, (d) => d.exercisesCompleted)}
          variant="bar"
        />
        <MiniPanel
          title="Höchstes Level"
          unitLabel=""
          points={toPoints(summary.days, (d) => d.highestLevelReached)}
          variant="bar"
        />
        <MiniPanel
          title="Ø Trial-to-Advance"
          unitLabel=""
          points={toPoints(summary.days, (d) => d.avgTrialToAdvanceRate ?? 0)}
          variant="line"
        />
        <MiniPanel
          title="Fehler-/Miss-Rate"
          unitLabel=" %"
          points={toPoints(summary.days, (d) => d.errorRate)}
          variant="line"
        />
      </div>
      <DataTable
        caption="Trainingsverlauf pro Tag"
        columns={['Tag', 'Übungen', 'Höchstes Level', 'Ø Trial-to-Advance', 'Fehler-/Miss-Rate']}
        rows={summary.days.map((d) => [
          d.sessionDay,
          d.exercisesCompleted,
          d.highestLevelReached,
          d.avgTrialToAdvanceRate === null ? '—' : d.avgTrialToAdvanceRate.toFixed(1),
          `${d.errorRate.toFixed(1)} %`,
        ])}
      />
    </div>
  );
}
