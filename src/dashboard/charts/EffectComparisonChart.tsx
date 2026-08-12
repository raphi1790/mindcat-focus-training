import type { EffectMetric, EffectSummary } from '../effectSummary';
import { CHART_COLORS, formatSigned } from './chartTheme';
import DataTable from './DataTable';

/**
 * Prä-vs-Post-Effektdarstellung (Plan §5.3 Punkt 1): kleine Slope-Charts je
 * Netzwerk-Score. Ein Rückgang gilt für alle fünf Metriken als Verbesserung
 * (schnellere/stabilere Verarbeitung, weniger Fehler) — daher eine
 * einheitliche ▼/▲-Kennzeichnung mit Text, nie Farbe allein.
 */

const WIDTH = 200;
const HEIGHT = 132;
const PAD_TOP = 28;
const PAD_BOTTOM = 26;
const X0 = 46;
const X1 = WIDTH - 46;

function computeDomain(a: number, b: number): [number, number] {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.15;
  return [min - pad, max + pad];
}

function yFor(value: number, domainMin: number, domainMax: number): number {
  const span = domainMax - domainMin;
  return HEIGHT - PAD_BOTTOM - ((value - domainMin) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
}

function unitSuffix(unit: EffectMetric['unit']): string {
  return unit === 'ms' ? ' ms' : ' %';
}

function MetricSlope({ metric }: { metric: EffectMetric }) {
  const [domainMin, domainMax] = computeDomain(metric.baseline, metric.post);
  const yBaseline = yFor(metric.baseline, domainMin, domainMax);
  const yPost = yFor(metric.post, domainMin, domainMax);
  const improved = metric.delta < 0;
  const unchanged = metric.delta === 0;
  const badgeColor = unchanged ? CHART_COLORS.inkMuted : improved ? CHART_COLORS.successText : CHART_COLORS.inkSecondary;
  const icon = unchanged ? '±' : improved ? '▼' : '▲';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-bold text-slate-700 leading-tight">{metric.label}</h4>
        <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: badgeColor }}>
          {icon} {formatSigned(metric.delta, unitSuffix(metric.unit))}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${metric.label}: Baseline ${Math.round(metric.baseline)}${unitSuffix(metric.unit)}, Post ${Math.round(metric.post)}${unitSuffix(metric.unit)}`}
        className="w-full h-auto"
      >
        <line
          x1={X0}
          y1={HEIGHT - PAD_BOTTOM + 10}
          x2={X1}
          y2={HEIGHT - PAD_BOTTOM + 10}
          stroke={CHART_COLORS.axis}
          strokeWidth={1}
        />
        <line x1={X0} y1={yBaseline} x2={X1} y2={yPost} stroke={CHART_COLORS.seriesBlue} strokeWidth={2} strokeLinecap="round" />
        <circle cx={X0} cy={yBaseline} r={5} fill={CHART_COLORS.inkMuted} stroke={CHART_COLORS.surface} strokeWidth={2} />
        <circle cx={X1} cy={yPost} r={5} fill={CHART_COLORS.seriesBlue} stroke={CHART_COLORS.surface} strokeWidth={2} />
        <text x={X0} y={Math.max(12, yBaseline - 10)} textAnchor="middle" fontSize={11} fill={CHART_COLORS.inkSecondary}>
          {Math.round(metric.baseline)}
          {unitSuffix(metric.unit)}
        </text>
        <text x={X1} y={Math.max(12, yPost - 10)} textAnchor="middle" fontSize={11} fill={CHART_COLORS.inkSecondary}>
          {Math.round(metric.post)}
          {unitSuffix(metric.unit)}
        </text>
        <text x={X0} y={HEIGHT - 4} textAnchor="middle" fontSize={10} fill={CHART_COLORS.inkMuted}>
          Baseline
        </text>
        <text x={X1} y={HEIGHT - 4} textAnchor="middle" fontSize={10} fill={CHART_COLORS.inkMuted}>
          Post
        </text>
      </svg>
    </div>
  );
}

export default function EffectComparisonChart({ summary }: { summary: EffectSummary }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS.inkMuted }} />
          Baseline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS.seriesBlue }} />
          Post
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {summary.metrics.map((m) => (
          <MetricSlope key={m.key} metric={m} />
        ))}
      </div>
      <DataTable
        caption="Prä/Post-Vergleich je Metrik"
        columns={['Metrik', 'Baseline', 'Post', 'Δ', '% Änderung']}
        rows={summary.metrics.map((m) => [
          m.label,
          `${Math.round(m.baseline)}${unitSuffix(m.unit)}`,
          `${Math.round(m.post)}${unitSuffix(m.unit)}`,
          formatSigned(m.delta, unitSuffix(m.unit)),
          m.percentChange === null ? '—' : `${m.percentChange.toFixed(1)} %`,
        ])}
      />
    </div>
  );
}
