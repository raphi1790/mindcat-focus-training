import { useMemo, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import TrainingGrid from './components/TrainingGrid';
import MazeExercise from './components/MazeExercise';
import { AssessmentRunner } from './assessment';
import { ChildProvider, ChildManagement, ChildSelectionScreen, useChildContext } from './children';
import { useChildrenProgress } from './children/useChildrenProgress';
import { getExerciseSetForAge } from './data/exerciseSet';
import type { NextStep } from './data/progress';
import type { AssessmentPhase } from './data/schema';

/**
 * App-Shell: Kinder-Auswahl (Phase 1) + Assessment-Orchestrierung (Phase 2).
 * Nach Auswahl ist ein childId aktiv (ChildProvider/ChildContext); alle
 * Reads/Writes laufen unter users/{uid}/children/{childId}/... (Plan §4).
 *
 * ANT-Läufe werden über den AssessmentRunner ausgeführt und als
 * `assessments`-Dokumente persistiert (Plan §5.2): fehlt die Baseline, plant
 * "Sitzung starten" zuerst den Baseline-ANT; nach Trainingstag 5 den
 * Post-ANT. Der Standalone-Start aus dem Tests-Tab läuft als `interim`.
 *
 * Trainings-Ergebnisse (TrainingGrid, MazeExercise) liefern noch keine
 * schema-vollständigen Daten (Per-Level-Stats) — deren Persistierung folgt
 * laut Phasenplan in Phase 4 (ExerciseEngine).
 */

// Interne Modul-Navigation innerhalb des Dashboards eines aktiven Kindes.
// Der Wechsel zwischen Kind-Auswahl/-Verwaltung und Dashboard läuft separat
// über AppShell (activeChild/managing), nicht über diesen Typ.
type ModuleView = 'DASHBOARD' | 'ASSESSMENT' | 'SIDE_EXERCISE' | 'MAZE_EXERCISE';

const TABS = {
  TRAINING_PLAN: 'TRAINING_PLAN',
  TESTS: 'TESTS',
  PROGRESS: 'PROGRESS',
} as const;
type Tab = (typeof TABS)[keyof typeof TABS];

interface ModuleCompletion {
  cancel?: boolean;
  [key: string]: unknown;
}

const EXERCISE_LABELS: Record<string, string> = {
  side: 'Side (Motorische Kontrolle)',
  chase: 'Chase (Verfolgung)',
  maze: 'Maze (Antizipation/Planung)',
  'anticipation-visible': 'Anticipation – sichtbar',
  'anticipation-invisible': 'Anticipation – unsichtbar',
  discrimination: 'Discrimination',
  'discrimination-delay': 'Discrimination – Delay',
  number: 'Number',
  'number-stroop': 'Number-Stroop',
  farmer: 'Farmer (Go/No-Go)',
};

function buildQueueForStep(nextStep: NextStep): ModuleView[] {
  switch (nextStep) {
    case 'baseline':
      return ['ASSESSMENT'];
    case 'training':
      return ['SIDE_EXERCISE', 'MAZE_EXERCISE'];
    case 'post':
      return ['ASSESSMENT'];
    case 'done':
      return [];
  }
}

interface AuthValue {
  currentUser: { uid: string; email: string | null } | null;
  logout: () => Promise<void>;
}

function DashboardShell() {
  const auth = useAuth() as AuthValue;
  const { currentUser, logout } = auth;
  const { activeChild, selectChild } = useChildContext();
  const uid = currentUser?.uid ?? '';

  const [view, setView] = useState<ModuleView>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<Tab>(TABS.TRAINING_PLAN);
  const [queue, setQueue] = useState<ModuleView[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  // Phase des aktuell laufenden ANT (baseline/post aus dem Fortschritt,
  // interim beim Standalone-Start aus dem Tests-Tab).
  const [assessmentPhase, setAssessmentPhase] = useState<AssessmentPhase>('interim');

  const childId = activeChild?.id ?? null;
  const { progress, refresh: refreshProgress } = useChildrenProgress(uid, childId ? [childId] : []);
  const childProgress = childId ? progress[childId] : undefined;

  const exerciseSet = useMemo(
    () => (activeChild ? getExerciseSetForAge(activeChild.ageGroup) : []),
    [activeChild],
  );

  if (!activeChild) {
    // Sollte nicht vorkommen (DashboardShell wird nur mit aktivem Kind gerendert),
    // schützt aber vor einem Zwischenzustand während des Kind-Wechsels.
    return null;
  }

  const handleChangeChild = () => {
    selectChild(null);
  };

  const handleStartSession = () => {
    if (!childProgress) return;
    const q = buildQueueForStep(childProgress.nextStep);
    if (q.length === 0) return;
    if (childProgress.nextStep === 'baseline' || childProgress.nextStep === 'post') {
      setAssessmentPhase(childProgress.nextStep);
    }
    setQueue(q);
    setQueueIndex(0);
    setView(q[0] as ModuleView);
  };

  const handleStandaloneStart = (moduleView: ModuleView) => {
    if (moduleView === 'ASSESSMENT') {
      // Freier Einzelstart außerhalb des Studienablaufs → Interim-Messung.
      setAssessmentPhase('interim');
    }
    setQueue([moduleView]);
    setQueueIndex(0);
    setView(moduleView);
  };

  const handleSessionCancel = () => {
    setQueue([]);
    setQueueIndex(0);
    setView('DASHBOARD');
  };

  const advanceQueue = () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      setView(queue[nextIndex] as ModuleView);
    } else {
      handleSessionCancel();
    }
  };

  const handleAssessmentFinished = () => {
    // Gespeichertes Assessment ändert den Studienfortschritt (Baseline/Post).
    refreshProgress();
    advanceQueue();
  };

  const handleModuleComplete = (moduleName: string, data: ModuleCompletion) => {
    if (data.cancel) {
      handleSessionCancel();
      return;
    }

    // TODO(Phase 4): Trainings-Ergebnisse über trainingSessionsRepo
    // persistieren, sobald die ExerciseEngine schema-vollständige Daten
    // liefert (Per-Level-Stats, Trial-to-Advance-Rate).
    console.info(`[${moduleName}] abgeschlossen (Persistierung folgt in Phase 4):`, data);

    advanceQueue();
  };

  if (view !== 'DASHBOARD') {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-hidden">
        {view === 'ASSESSMENT' && (
          <AssessmentRunner
            uid={uid}
            childId={activeChild.id}
            ageGroup={activeChild.ageGroup}
            phase={assessmentPhase}
            onFinished={handleAssessmentFinished}
            onCancel={handleSessionCancel}
          />
        )}
        {view === 'SIDE_EXERCISE' && (
          <TrainingGrid onComplete={(data: ModuleCompletion) => handleModuleComplete('Side Exercise', data)} />
        )}
        {view === 'MAZE_EXERCISE' && (
          <MazeExercise onComplete={(data: ModuleCompletion) => handleModuleComplete('Maze Exercise', data)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800">
      <div className="w-64 bg-slate-900 text-white flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10">
          <span className="text-3xl">🧠</span>
          <h1 className="text-xl font-bold leading-tight">
            Focus
            <br />
            Dashboard
          </h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab(TABS.TRAINING_PLAN)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === TABS.TRAINING_PLAN ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            🗓️ 5-Tage Plan
          </button>

          <button
            onClick={() => setActiveTab(TABS.TESTS)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === TABS.TESTS ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            📋 Einzeltests
          </button>

          <button
            onClick={() => setActiveTab(TABS.PROGRESS)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === TABS.PROGRESS ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            📊 Fortschritt
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-3">
          <div className="text-sm font-medium text-slate-300">
            👤 {activeChild.displayName}
            <span className="block text-xs text-slate-500 mt-0.5">{activeChild.ageGroup} Jahre</span>
          </div>
          <button
            onClick={handleChangeChild}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors py-2 rounded-lg text-sm font-medium border border-slate-700"
          >
            Kind wechseln
          </button>
          <div className="text-xs text-slate-500 truncate" title={currentUser?.email ?? undefined}>
            {currentUser?.email}
          </div>
          <button
            onClick={() => void logout()}
            className="w-full bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 transition-colors py-2 rounded-lg text-sm font-medium border border-slate-700 hover:border-red-900/50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-12 relative">
        <header className="mb-12">
          <h2 className="text-4xl font-bold text-slate-800">
            {activeTab === TABS.TRAINING_PLAN && 'Trainings-Programm'}
            {activeTab === TABS.TESTS && 'Stand-Alone Module'}
            {activeTab === TABS.PROGRESS && 'Fortschritt'}
          </h2>
          <p className="text-slate-500 mt-2 text-lg">
            {activeTab === TABS.TRAINING_PLAN && `Programm für ${activeChild.displayName}.`}
            {activeTab === TABS.TESTS && 'Führe Einzeltests oder Übungen frei durch.'}
            {activeTab === TABS.PROGRESS && `Studienablauf von ${activeChild.displayName}.`}
          </p>
        </header>

        {activeTab === TABS.TRAINING_PLAN && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-8 rounded-3xl shadow-lg text-white">
              <div className="text-6xl mb-6">🗓️</div>
              <h3 className="text-3xl font-bold mb-4">Das Rueda (2005) Protokoll</h3>
              <p className="text-purple-100 mb-8 text-lg max-w-2xl">
                Baseline-ANT vor Tag 1, fünf Trainingstage, Abschluss-ANT nach Tag 5. Die App bestimmt
                automatisch den nächsten Schritt für {activeChild.displayName}.
              </p>
              <div className="flex gap-4 items-center">
                <button
                  onClick={handleStartSession}
                  disabled={!childProgress || childProgress.nextStep === 'done'}
                  className="bg-white text-purple-700 font-bold py-4 px-8 rounded-2xl hover:bg-purple-50 transition-colors text-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {childProgress?.nextStep === 'done' ? 'Programm abgeschlossen' : 'Sitzung Starten'}
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-3">
                Übungsset für Altersgruppe {activeChild.ageGroup}
              </h3>
              <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                {exerciseSet.map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {EXERCISE_LABELS[id] ?? id}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-4">
                Die meisten Übungen sind noch nicht implementiert (Phase 4). Aktuell spielbar: Side, Maze.
              </p>
            </div>
          </div>
        )}

        {activeTab === TABS.TESTS && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div className="text-5xl mb-4">🐟</div>
              <h3 className="text-2xl font-bold mb-2">Child ANT</h3>
              <p className="text-slate-600 mb-6 flex-1 text-sm">
                Klassischer Flanker-Test zur Messung der exekutiven Aufmerksamkeit. Läuft hier als
                Interim-Messung (zählt nicht als Baseline/Post).
              </p>
              <button
                onClick={() => handleStandaloneStart('ASSESSMENT')}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors"
              >
                Starten
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div className="text-5xl mb-4">🐱</div>
              <h3 className="text-2xl font-bold mb-2">Side Exercise</h3>
              <p className="text-slate-600 mb-6 flex-1 text-sm">
                Freie Navigation auf einem Raster mit Zielgebieten und Hindernissen.
              </p>
              <button
                onClick={() => handleStandaloneStart('SIDE_EXERCISE')}
                className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-colors"
              >
                Starten
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div className="text-5xl mb-4">🧩</div>
              <h3 className="text-2xl font-bold mb-2">Maze Exercise</h3>
              <p className="text-slate-600 mb-6 flex-1 text-sm">
                Labyrinth-Training. Erfordert motorische Antizipation durch Kurven.
              </p>
              <button
                onClick={() => handleStandaloneStart('MAZE_EXERCISE')}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Starten
              </button>
            </div>
          </div>
        )}

        {activeTab === TABS.PROGRESS && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            {!childProgress ? (
              <p className="text-slate-400">Lade Fortschritt…</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="p-4 rounded-xl bg-slate-50">
                  <div className="text-xs uppercase text-slate-400 font-bold mb-1">Baseline</div>
                  <div className="text-lg font-bold text-slate-700">
                    {childProgress.baselineDone ? 'Erledigt' : 'Offen'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <div className="text-xs uppercase text-slate-400 font-bold mb-1">Trainingstage</div>
                  <div className="text-lg font-bold text-slate-700">{childProgress.completedDays} / 5</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <div className="text-xs uppercase text-slate-400 font-bold mb-1">Post-Test</div>
                  <div className="text-lg font-bold text-slate-700">
                    {childProgress.postDone ? 'Erledigt' : 'Offen'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <div className="text-xs uppercase text-slate-400 font-bold mb-1">Nächster Schritt</div>
                  <div className="text-lg font-bold text-purple-700">{childProgress.nextStep}</div>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-6">
              Detaillierte Prä/Post-Auswertung und Datenexport folgen in Phase 3 (Dashboard).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AppShell() {
  const auth = useAuth() as AuthValue;
  const { currentUser, logout } = auth;
  const { activeChild, selectChild } = useChildContext();
  const [managing, setManaging] = useState(false);

  if (managing) {
    return <ChildManagement onBack={() => setManaging(false)} />;
  }

  if (!activeChild) {
    return (
      <ChildSelectionScreen
        uid={currentUser?.uid ?? ''}
        onChildConfirmed={selectChild}
        onManage={() => setManaging(true)}
        supervisorEmail={currentUser?.email}
        onLogout={() => void logout()}
      />
    );
  }

  return <DashboardShell />;
}

export default function App() {
  const auth = useAuth() as AuthValue;
  const { currentUser } = auth;

  if (!currentUser) {
    return <Login />;
  }

  return (
    <ChildProvider uid={currentUser.uid}>
      <AppShell />
    </ChildProvider>
  );
}
