import type { GroupComparisonEntry } from '../groupComparison';
import { CHART_COLORS, formatSigned, roundedTopBarPath } from './chartTheme';
import DataTable from './DataTable';

/**
 * Gruppenvergleich trained vs. control (Plan §5.3 Punkt 4): Δ Conflict-Score
 * ist die im Studien-Kontext aussagekräftigste Metrik ("am deutlichsten in
 * Konflikt-Score", Plan §10) und bekommt den Haupt-Chart; die übrigen Δs
 * stehen in der Tabelle. Farbe folgt der Gruppen-Identität, nie der
 * Reihenfolge im Datensatz.
 */

const WIDTH = 260;
const HEIGHT = 160;
const PAD_LEFT = 36;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

const GROUP_COLOR: Record<'trained' | 'control', string> = {
  trained: CHART_COLORS.seriesBlue,
  control: CHART_COLORS.seriesAqua,
};
const GROUP_LABEL: Record<'trained' | 'control', string> = {
  trained: 'Trainiert',
  control: 'Kontrolle',
};

export default function GroupComparisonChart({ entries }: { entries: GroupComparisonEntry[] }) {
  const values = entries.map((e) => e.avgDeltaByMetric.conflictRT);
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const domainMax = maxAbs * 1.2;
  const yFor = (v: number) => PAD_TOP + PLOT_HEIGHT / 2 - (v / domainMax) * (PLOT_HEIGHT / 2);
  const zeroY = yFor(0);
  const slotWidth = PLOT_WIDTH / Math.max(1, entries.length);

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
        {entries.map((e) => (
          <span key={e.studyGroup} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GROUP_COLOR[e.studyGroup] }} />
            {GROUP_LABEL[e.studyGroup]} (n={e.n})
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Δ Conflict-Score nach Gruppe: ${entries.map((e) => `${GROUP_LABEL[e.studyGroup]} ${Math.round(e.avgDeltaByMetric.conflictRT)} ms`).join(', ')}`}
        className="w-full h-auto"
      >
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={zeroY} y2={zeroY} stroke={CHART_COLORS.axis} strokeWidth={1} />

        {entries.map((e, i) => {
          const barWidth = Math.min(48, slotWidth - 16);
          const x = PAD_LEFT + slotWidth * (i + 0.5) - barWidth / 2;
          const value = e.avgDeltaByMetric.conflictRT;
          const y = yFor(value);
          const top = Math.min(y, zeroY);
          const height = Math.abs(y - zeroY);
          return (
            <g key={e.studyGroup}>
              <path d={roundedTopBarPath(x, top, barWidth, height)} fill={GROUP_COLOR[e.studyGroup]} />
              <text
                x={x + barWidth / 2}
                y={value >= 0 ? top - 6 : top + height + 14}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_COLORS.inkSecondary}
              >
                {formatSigned(value, ' ms')}
              </text>
              <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill={CHART_COLORS.inkMuted}>
                {GROUP_LABEL[e.studyGroup]}
              </text>
            </g>
          );
        })}
      </svg>

      <DataTable
        caption="Gruppenvergleich Δ je Metrik"
        columns={['Gruppe', 'n', 'Δ Overall-RT', 'Δ Conflict', 'Δ Alerting', 'Δ Orienting', 'Δ Fehlerrate']}
        rows={entries.map((e) => [
          GROUP_LABEL[e.studyGroup],
          e.n,
          formatSigned(e.avgDeltaByMetric.overallRT, ' ms'),
          formatSigned(e.avgDeltaByMetric.conflictRT, ' ms'),
          formatSigned(e.avgDeltaByMetric.alertingRT, ' ms'),
          formatSigned(e.avgDeltaByMetric.orientingRT, ' ms'),
          formatSigned(e.avgDeltaByMetric.overallErrorRate, ' %'),
        ])}
      />
    </div>
  );
}
