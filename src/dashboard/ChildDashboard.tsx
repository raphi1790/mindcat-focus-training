import { useMemo, type ReactNode } from 'react';
import type { Child } from '../data/schema';
import EffectComparisonChart from './charts/EffectComparisonChart';
import ExerciseLevelGrid from './charts/ExerciseLevelGrid';
import GroupComparisonChart from './charts/GroupComparisonChart';
import RtHistogramChart from './charts/RtHistogramChart';
import TrainingProgressChart from './charts/TrainingProgressChart';
import { computeExerciseLevelOverview } from './exerciseLevelStatus';
import {
  buildFullExportJson,
  downloadTextFile,
  scoresToCsv,
  sessionsToCsv,
  slugifyFilename,
  trialsToCsv,
} from './exportData';
import { useChildDashboardData } from './useChildDashboardData';
import { useGroupComparisonData } from './useGroupComparisonData';

/**
 * Dashboard-Auswertung eines Kindes (Plan §5.3, Phase 3): Prä/Post-Effekt,
 * Trainingsverlauf, RT-Verteilung, Gruppenvergleich, Datenexport.
 */
interface ChildDashboardProps {
  uid: string;
  child: Child;
}

export default function ChildDashboard({ uid, child }: ChildDashboardProps) {
  const { loading, error, assessments, sessions, effectSummary, trainingSummary, histogram } =
    useChildDashboardData(uid, child.id);
  const group = useGroupComparisonData(uid);
  const exerciseOverview = useMemo(
    () => computeExerciseLevelOverview(sessions, child.ageGroup),
    [sessions, child.ageGroup],
  );

  if (loading) {
    return <p className="text-slate-400">Auswertung wird geladen…</p>;
  }
  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  const hasAnyData = assessments.length > 0 || sessions.length > 0;
  if (!hasAnyData) {
    return <p className="text-slate-400">Noch keine Daten für {child.displayName} vorhanden.</p>;
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const slug = slugifyFilename(child.displayName);

  const exportTrialsCsv = () =>
    downloadTextFile(`${slug}-trials-${dateStamp}.csv`, trialsToCsv(assessments), 'text/csv;charset=utf-8');
  const exportScoresCsv = () =>
    downloadTextFile(`${slug}-scores-${dateStamp}.csv`, scoresToCsv(assessments), 'text/csv;charset=utf-8');
  const exportSessionsCsv = () =>
    downloadTextFile(
      `${slug}-trainingssitzungen-${dateStamp}.csv`,
      sessionsToCsv(sessions),
      'text/csv;charset=utf-8',
    );
  const exportFullJson = () => {
    const json = buildFullExportJson(child, assessments, sessions);
    downloadTextFile(`${slug}-rohdaten-${dateStamp}.json`, JSON.stringify(json, null, 2), 'application/json');
  };

  const excludedAssessments = assessments.filter((a) => a.quality.excluded);

  return (
    <div className="space-y-6">
      {excludedAssessments.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold">
            <span className="text-xl">⚠️</span>
            <span>Ausschlusshinweis: Ungültiger ANT-Testlauf erkannt</span>
          </div>
          {excludedAssessments.map((a) => (
            <p key={a.id} className="text-sm text-amber-700">
              Der <strong>{a.phase.toUpperCase()}</strong>-Testlauf (
              {a.timestamp instanceof Date
                ? a.timestamp.toLocaleDateString()
                : new Date((a.timestamp as { seconds?: number }).seconds ? (a.timestamp as { seconds: number }).seconds * 1000 : String(a.timestamp)).toLocaleDateString()}
              ) wurde aufgrund hoher Fehlerrate (<strong>{(a.scores.overallErrorRate * 100).toFixed(1)} %</strong>, Schwelle: &gt; 40 %) von der statistischen Prä/Post-Auswertung ausgeschlossen.
            </p>
          ))}
        </div>
      )}

      <Section title="Prä-vs-Post-Effekt">
        {effectSummary ? (
          <EffectComparisonChart summary={effectSummary} />
        ) : (
          <p className="text-slate-400 text-sm">
            Für den Effektvergleich werden ein gültiger Baseline- und ein gültiger Post-Test benötigt.
          </p>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Wissenschaftliche Normwerte nach Rueda et al. (2005) — {child.ageGroup} Jahre
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700 block">Overall-RT:</span>
              {child.ageGroup === 4 ? '1500 – 1900 ms' : '900 – 1100 ms'}
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700 block">Conflict-Score:</span>
              {child.ageGroup === 4 ? '130 – 260 ms' : '34 – 86 ms'}
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700 block">Fehlerrate:</span>
              {child.ageGroup === 4 ? '12 – 18 %' : '2 – 3 %'}
              <span className="block text-[10px] text-slate-400 mt-0.5">(Ausschluss bei &gt; 40 %)</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Trainingsverlauf">
        <div className="space-y-6">
          <ExerciseLevelGrid overview={exerciseOverview} />
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Verlauf über die 5 Trainingstage
            </h4>
            <TrainingProgressChart summary={trainingSummary} />
          </div>
        </div>
      </Section>

      <Section title="RT-Verteilung (korrekte Trials)">
        {histogram ? (
          <RtHistogramChart histogram={histogram} />
        ) : (
          <p className="text-slate-400 text-sm">Noch keine auswertbaren Testläufe vorhanden.</p>
        )}
      </Section>

      <Section title="Gruppenvergleich (trainiert vs. Kontrolle)">
        {group.loading ? (
          <p className="text-slate-400 text-sm">Lädt…</p>
        ) : group.entries.length > 0 ? (
          <GroupComparisonChart entries={group.entries} />
        ) : (
          <p className="text-slate-400 text-sm">
            Für einen Gruppenvergleich mindestens ein Kind mit Studiengruppe (trainiert/Kontrolle) und
            gültigem Prä/Post-Test anlegen.
          </p>
        )}
      </Section>

      <Section title="Datenexport">
        <p className="text-slate-500 text-sm mb-4">
          Rohdaten für externe statistische Auswertung — vollständige Trial-Logs und Scores.
        </p>
        <div className="flex flex-wrap gap-3">
          <ExportButton onClick={exportTrialsCsv} label="Trials (CSV)" />
          <ExportButton onClick={exportScoresCsv} label="Scores (CSV)" />
          <ExportButton onClick={exportSessionsCsv} label="Trainingssitzungen (CSV)" />
          <ExportButton onClick={exportFullJson} label="Alles (JSON)" primary />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-700 mb-4">{title}</h3>
      {children}
    </section>
  );
}

function ExportButton({
  onClick,
  label,
  primary = false,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
        primary ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      ⬇ {label}
    </button>
  );
}
