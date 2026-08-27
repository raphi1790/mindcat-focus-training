import type { ExerciseLevelOverview } from '../exerciseLevelStatus';
import DataTable from './DataTable';

interface ExerciseLevelGridProps {
  overview: ExerciseLevelOverview;
}

export default function ExerciseLevelGrid({ overview }: ExerciseLevelGridProps) {
  const { exercises, activeCheckpoint } = overview;

  return (
    <div className="space-y-4">
      {activeCheckpoint && (
        <div
          role="status"
          aria-live="polite"
          className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              💾
            </span>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-purple-700">
                Aktiver Spielstand gespeichert ({activeCheckpoint.sessionDay > 0 ? `Tag ${activeCheckpoint.sessionDay}` : 'Einzelübung'})
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {activeCheckpoint.exerciseIcon} {activeCheckpoint.exerciseLabel} —{' '}
                <span className="text-purple-700 font-bold">Level {activeCheckpoint.level}</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-200/70 text-purple-800 shrink-0 self-start sm:self-auto">
            Wird bei Start fortgesetzt
          </span>
        </div>
      )}

      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Erreichte Level nach Übung
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {exercises.map((item) => {
            const percent = Math.min(100, Math.round((item.highestLevel / item.maxLevel) * 100));

            return (
              <div
                key={item.exerciseId}
                className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all ${
                  item.activeCheckpoint
                    ? 'border-purple-300 ring-2 ring-purple-100'
                    : item.isCompletedMax
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : item.hasPlayed
                        ? 'border-slate-200'
                        : 'border-slate-100 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="font-bold text-sm text-slate-800 truncate" title={item.label}>
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      item.activeCheckpoint
                        ? 'bg-amber-100 text-amber-800'
                        : item.isCompletedMax
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.hasPlayed
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.activeCheckpoint
                      ? `⚡ Level ${item.activeCheckpoint.level}`
                      : item.isCompletedMax
                        ? `Level ${item.maxLevel} ⭐`
                        : item.hasPlayed
                          ? `Level ${item.highestLevel}/${item.maxLevel}`
                          : 'Nicht gestartet'}
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden my-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.isCompletedMax
                        ? 'bg-emerald-500'
                        : item.hasPlayed
                          ? 'bg-purple-600'
                          : 'bg-slate-300'
                    }`}
                    style={{ width: `${item.hasPlayed ? percent : 0}%` }}
                    role="progressbar"
                    aria-valuenow={item.highestLevel}
                    aria-valuemin={0}
                    aria-valuemax={item.maxLevel}
                    aria-label={`${item.label}: Level ${item.highestLevel} von ${item.maxLevel}`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    {item.hasPlayed
                      ? `${item.totalTrials} ${item.totalTrials === 1 ? 'Trial' : 'Trials'}`
                      : '0 Trials'}
                  </span>
                  <span>
                    {item.hasPlayed
                      ? `${item.totalErrors + item.totalMissed} ${
                          item.totalErrors + item.totalMissed === 1 ? 'Fehler' : 'Fehler'
                        }`
                      : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DataTable
        caption="Erreichte Level pro Übung"
        columns={['Übung', 'Erreichtes Level', 'Maximalstufe', 'Trials', 'Fehler/Misses', 'Status']}
        rows={exercises.map((e) => [
          `${e.icon} ${e.label}`,
          e.highestLevel > 0 ? `Level ${e.highestLevel}` : '—',
          `Level ${e.maxLevel}`,
          e.totalTrials,
          e.totalErrors + e.totalMissed,
          e.activeCheckpoint
            ? e.activeCheckpoint.sessionDay > 0
              ? `In Bearbeitung (Tag ${e.activeCheckpoint.sessionDay})`
              : 'In Bearbeitung (Einzelübung)'
            : e.isCompletedMax
              ? 'Maximalstufe erreicht'
              : e.hasPlayed
                ? 'Gespielt'
                : 'Ausstehend',
        ])}
      />
    </div>
  );
}
