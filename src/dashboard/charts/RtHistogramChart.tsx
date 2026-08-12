import { useState } from 'react';
import type { RtHistogram } from '../histogram';
import { CHART_COLORS, niceMax, roundedTopBarPath } from './chartTheme';
import DataTable from './DataTable';

/**
 * RT-Histogramm congruent vs. incongruent (Plan §5.3 Punkt 3) — Transparenz
 * über die Datenqualität hinter dem Conflict-Score.
 */

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const BASELINE_Y = PAD_TOP + PLOT_HEIGHT;

interface HoverState {
  x: number;
  y: number;
  label: string;
  congruent: number;
  incongruent: number;
}

export default function RtHistogramChart({ histogram }: { histogram: RtHistogram }) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const maxCount = niceMax(
    Math.max(1, ...histogram.bins.flatMap((b) => [b.congruentCount, b.incongruentCount])),
  );
  const binCount = histogram.bins.length;
  const groupWidth = PLOT_WIDTH / binCount;
  const barWidth = Math.min(24, (groupWidth - 6) / 2);
  const barGap = 2;

  const yFor = (count: number) => BASELINE_Y - (count / maxCount) * PLOT_HEIGHT;
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: CHART_COLORS.seriesBlue }} />
          Congruent (n={histogram.congruentN})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: CHART_COLORS.seriesRed }} />
          Incongruent (n={histogram.incongruentN})
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="RT-Verteilung korrekter Trials, congruent vs. incongruent"
          className="w-full h-auto"
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(t)} y2={yFor(t)} stroke={CHART_COLORS.grid} strokeWidth={1} />
              <text x={PAD_LEFT - 6} y={yFor(t) + 3} textAnchor="end" fontSize={10} fill={CHART_COLORS.inkMuted}>
                {t}
              </text>
            </g>
          ))}
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={BASELINE_Y} y2={BASELINE_Y} stroke={CHART_COLORS.axis} strokeWidth={1} />

          {histogram.bins.map((bin, i) => {
            const groupX = PAD_LEFT + i * groupWidth;
            const congruentX = groupX + groupWidth / 2 - barWidth - barGap / 2;
            const incongruentX = groupX + groupWidth / 2 + barGap / 2;
            const congruentY = yFor(bin.congruentCount);
            const incongruentY = yFor(bin.incongruentCount);
            const label = `${Math.round(bin.binStart)}–${Math.round(bin.binEnd)} ms`;
            const showHover = (clientX: number, clientY: number) =>
              setHover({ x: clientX, y: clientY, label, congruent: bin.congruentCount, incongruent: bin.incongruentCount });

            return (
              <g key={label}>
                <path
                  d={roundedTopBarPath(congruentX, congruentY, barWidth, BASELINE_Y - congruentY)}
                  fill={CHART_COLORS.seriesBlue}
                  onMouseEnter={(e) => showHover(e.clientX, e.clientY)}
                  onMouseMove={(e) => showHover(e.clientX, e.clientY)}
                />
                <path
                  d={roundedTopBarPath(incongruentX, incongruentY, barWidth, BASELINE_Y - incongruentY)}
                  fill={CHART_COLORS.seriesRed}
                  onMouseEnter={(e) => showHover(e.clientX, e.clientY)}
                  onMouseMove={(e) => showHover(e.clientX, e.clientY)}
                />
                <text x={groupX + groupWidth / 2} y={BASELINE_Y + 16} textAnchor="middle" fontSize={9} fill={CHART_COLORS.inkMuted}>
                  {Math.round(bin.binStart)}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="pointer-events-none fixed z-50 bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <div className="font-semibold mb-0.5">{hover.label}</div>
            <div>Congruent: {hover.congruent}</div>
            <div>Incongruent: {hover.incongruent}</div>
          </div>
        )}
      </div>

      <DataTable
        caption="RT-Verteilung congruent vs. incongruent"
        columns={['Bin (ms)', 'Congruent', 'Incongruent']}
        rows={histogram.bins.map((b) => [`${Math.round(b.binStart)}–${Math.round(b.binEnd)}`, b.congruentCount, b.incongruentCount])}
      />
    </div>
  );
}
