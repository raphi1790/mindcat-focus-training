// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Assessment } from '../../data/schema';
import type { EffectSummary } from '../effectSummary';
import EffectComparisonChart from './EffectComparisonChart';
import { formatMetricValue, formatSigned } from './chartTheme';

describe('formatSigned', () => {
  it('formatiert Werte ohne Dezimalstellen-Angabe mit Standardrundung', () => {
    expect(formatSigned(-80, ' ms')).toBe('−80 ms');
    expect(formatSigned(80, ' ms')).toBe('+80 ms');
    expect(formatSigned(0, ' ms')).toBe('±0 ms');
  });

  it('formatiert Werte mit definierter Dezimalstellen-Präzision', () => {
    expect(formatSigned(-2.4, ' %', 1)).toBe('−2.4 %');
    expect(formatSigned(2.4, ' %', 1)).toBe('+2.4 %');
    expect(formatSigned(2, ' %', 1)).toBe('+2.0 %');
    expect(formatSigned(0, ' %', 1)).toBe('±0.0 %');
  });
});

describe('formatMetricValue', () => {
  it('formatiert Prozentwerte mit 1 Nachkommastelle', () => {
    expect(formatMetricValue(2.4, '%')).toBe('2.4 %');
    expect(formatMetricValue(15, '%')).toBe('15.0 %');
    expect(formatMetricValue(0, '%')).toBe('0.0 %');
  });

  it('formatiert ms-Werte als gerundete Ganzzahlen', () => {
    expect(formatMetricValue(1234.6, 'ms')).toBe('1235 ms');
    expect(formatMetricValue(1234.2, 'ms')).toBe('1234 ms');
  });
});

describe('EffectComparisonChart', () => {
  afterEach(() => {
    cleanup();
  });

  const mockSummary: EffectSummary = {
    baseline: {} as unknown as Assessment,
    post: {} as unknown as Assessment,
    metrics: [
      {
        key: 'overallRT',
        label: 'Overall-RT',
        unit: 'ms',
        baseline: 1500,
        post: 1200,
        delta: -300,
        percentChange: -20,
      },
      {
        key: 'conflictRT',
        label: 'Conflict-Score',
        unit: 'ms',
        baseline: 200,
        post: 150,
        delta: -50,
        percentChange: -25,
      },
      {
        key: 'alertingRT',
        label: 'Alerting-Score',
        unit: 'ms',
        baseline: 50,
        post: 80,
        delta: 30, // Positives Delta = Verbesserung beim Alerting-Nutzen
        percentChange: 60,
      },
      {
        key: 'orientingRT',
        label: 'Orienting-Score',
        unit: 'ms',
        baseline: 60,
        post: 40,
        delta: -20, // Negatives Delta = Verschlechterung beim Orienting-Nutzen
        percentChange: -33.3,
      },
      {
        key: 'overallErrorRate',
        label: 'Fehlerrate',
        unit: '%',
        baseline: 12.4,
        post: 4.2,
        delta: -8.2,
        percentChange: -66.1,
      },
    ],
  };

  it('rendert Metrikkarten mit richtiger Trend-Richtung und korrekten Pfeilen', () => {
    render(<EffectComparisonChart summary={mockSummary} />);

    // Alerting-Benefit gestiegen (delta > 0): Pfeil nach oben ▲
    const alertingCard = screen.getByRole('heading', { name: 'Alerting-Score' }).closest('div')!;
    expect(alertingCard.textContent).toContain('▲');
    expect(alertingCard.textContent).toContain('+30 ms');

    // Orienting-Benefit gesunken (delta < 0): Pfeil nach unten ▼
    const orientingCard = screen.getByRole('heading', { name: 'Orienting-Score' }).closest('div')!;
    expect(orientingCard.textContent).toContain('▼');
    expect(orientingCard.textContent).toContain('−20 ms');

    // Conflict-Score gesunken (delta < 0): Pfeil nach unten ▼
    const conflictCard = screen.getByRole('heading', { name: 'Conflict-Score' }).closest('div')!;
    expect(conflictCard.textContent).toContain('▼');
    expect(conflictCard.textContent).toContain('−50 ms');
  });

  it('formatiert Fehlerrate in der DataTable mit Dezimalstellen', () => {
    render(<EffectComparisonChart summary={mockSummary} />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('12.4 %')).toBeDefined();
    expect(within(table).getByText('4.2 %')).toBeDefined();
    expect(within(table).getByText('−8.2 %')).toBeDefined();
  });
});
