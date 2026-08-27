import { useMemo, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import { AssessmentRunner } from './assessment';
import { ChildProvider, ChildManagement, ChildSelectionScreen, useChildContext } from './children';
import { useChildrenProgress } from './children/useChildrenProgress';
import { ChildDashboard } from './dashboard';
import { getExerciseSetForAge } from './data/exerciseSet';
import type { NextStep } from './data/progress';
import type { AssessmentPhase, ExerciseId, ExerciseResult } from './data/schema';
import { buildTrainingPlan, EXERCISE_COMPONENTS, EXERCISE_ICONS, EXERCISE_LABELS, ExerciseCompletionModal, TrainingSessionRunner } from './training';
import { ErrorBoundary } from './ui';

/**
 * App-Shell: Kinder-Auswahl (Phase 1) + Assessment-Orchestrierung (Phase 2)
 * + Trainings-Orchestrierung (Phase 4).
 * Nach Auswahl ist ein childId aktiv (ChildProvider/ChildContext); alle
 * Reads/Writes laufen unter users/{uid}/children/{childId}/... (Plan §4).
 *
 * ANT-Läufe werden über den AssessmentRunner ausgeführt und als
 * `assessments`-Dokumente persistiert (Plan §5.2): fehlt die Baseline, plant
 * "Sitzung starten" zuerst den Baseline-ANT; nach Trainingstag 5 den
 * Post-ANT. Der Standalone-Start aus dem Tests-Tab läuft als `interim`.
 *
 * Trainingstage laufen über `TrainingSessionRunner`: der `buildTrainingPlan`-
 * Scheduler bestimmt die Übungen des jeweils nächsten Tages, das Ergebnis
 * wird als vollständiges `trainingSessions`-Dokument persistiert. Freie
 * Einzelübungen aus dem "Einzeltests"-Tab laufen standalone (ohne
 * Persistierung, analog zur Interim-Messung des ANT).
 */

// Interne Modul-Navigation innerhalb des Dashboards eines aktiven Kindes.
// Der Wechsel zwischen Kind-Auswahl/-Verwaltung und Dashboard läuft separat
// über AppShell (activeChild/managing), nicht über diesen Typ.
type ModuleView = 'DASHBOARD' | 'ASSESSMENT' | 'TRAINING_SESSION' | 'STANDALONE_EXERCISE';

const TABS = {
  TRAINING_PLAN: 'TRAINING_PLAN',
  TESTS: 'TESTS',
  PROGRESS: 'PROGRESS',
} as const;
type Tab = (typeof TABS)[keyof typeof TABS];

function moduleForStep(nextStep: NextStep): ModuleView | null {
  switch (nextStep) {
    case 'baseline':
      return 'ASSESSMENT';
    case 'training':
      return 'TRAINING_SESSION';
    case 'post':
      return 'ASSESSMENT';
    case 'done':
      return null;
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
  // Phase des aktuell laufenden ANT (baseline/post aus dem Fortschritt,
  // interim beim Standalone-Start aus dem Tests-Tab).
  const [assessmentPhase, setAssessmentPhase] = useState<AssessmentPhase>('interim');
  // Freier Einzelstart einer Übung aus dem Tests-Tab (Seed fix pro Lauf).
  const [standaloneExercise, setStandaloneExercise] = useState<{ id: ExerciseId; seed: string } | null>(
    null,
  );
  const [completedStandalone, setCompletedStandalone] = useState<{
    id: ExerciseId;
    result: ExerciseResult;
  } | null>(null);

  const childId = activeChild?.id ?? null;
  const { progress, refresh: refreshProgress } = useChildrenProgress(uid, childId ? [childId] : []);
  const childProgress = childId ? progress[childId] : undefined;

  const exerciseSet = useMemo(
    () => (activeChild ? getExerciseSetForAge(activeChild.ageGroup) : []),
    [activeChild],
  );
  const trainingPlan = useMemo(
    () => (activeChild ? buildTrainingPlan(activeChild.ageGroup) : []),
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
    const moduleView = moduleForStep(childProgress.nextStep);
    if (!moduleView) return;
    if (childProgress.nextStep === 'baseline' || childProgress.nextStep === 'post') {
      setAssessmentPhase(childProgress.nextStep);
    }
    setView(moduleView);
  };

  const handleStandaloneAssessment = () => {
    // Freier Einzelstart außerhalb des Studienablaufs → Interim-Messung.
    setAssessmentPhase('interim');
    setView('ASSESSMENT');
  };

  const handleStandaloneExercise = (id: ExerciseId) => {
    // Fester Seed statt Zufalls-UUID (AP3, Fix-Plan Testrunde 1) — auch der
    // freie Einzeltest liefert damit reproduzierbare Sequenzen.
    setCompletedStandalone(null);
    setStandaloneExercise({ id, seed: `mindcat-v1:practice:${id}` });
    setView('STANDALONE_EXERCISE');
  };

  const handleSessionCancel = () => {
    setCompletedStandalone(null);
    setStandaloneExercise(null);
    setView('DASHBOARD');
  };

  const handleAssessmentFinished = () => {
    // Gespeichertes Assessment ändert den Studienfortschritt (Baseline/Post).
    refreshProgress();
    setView('DASHBOARD');
  };

  const handleTrainingSessionFinished = () => {
    // Gespeicherte Trainingssitzung ändert den Studienfortschritt (Tag n/5).
    refreshProgress();
    setView('DASHBOARD');
  };

  const handleStandaloneExerciseComplete = (result: ExerciseResult) => {
    if (standaloneExercise) {
      setCompletedStandalone({ id: standaloneExercise.id, result });
    }
  };

  const handleCloseStandaloneModal = () => {
    setCompletedStandalone(null);
    setStandaloneExercise(null);
    setView('DASHBOARD');
  };

  const handleRestartStandalone = () => {
    const id = completedStandalone?.id ?? standaloneExercise?.id;
    setCompletedStandalone(null);
    if (id) {
      handleStandaloneExercise(id);
    }
  };

  const handleErrorReset = () => {
    // Nach einem abgefangenen Renderfehler zurück ins Dashboard. Der Fortschritt
    // ist dank inkrementellem Speichern (AP6) sicher; Neu-Laden aktualisiert die
    // Anzeige. Ein erneuter Start setzt am letzten Checkpoint fort.
    setCompletedStandalone(null);
    setStandaloneExercise(null);
    refreshProgress();
    setView('DASHBOARD');
  };

  if (view !== 'DASHBOARD') {
    const StandaloneComponent = standaloneExercise ? EXERCISE_COMPONENTS[standaloneExercise.id] : null;
    const dayExercises = trainingPlan[(childProgress?.nextSessionDay ?? 1) - 1] ?? [];

    return (
      <div className="fixed inset-0 bg-white z-50 overflow-hidden">
        <ErrorBoundary onReset={handleErrorReset}>
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
          {view === 'TRAINING_SESSION' && (
            <TrainingSessionRunner
              uid={uid}
              childId={activeChild.id}
              ageGroup={activeChild.ageGroup}
              sessionDay={childProgress?.nextSessionDay ?? 1}
              exerciseIds={dayExercises}
              onFinished={handleTrainingSessionFinished}
              onCancel={handleSessionCancel}
            />
          )}
          {view === 'STANDALONE_EXERCISE' && standaloneExercise && StandaloneComponent && (
            <>
              <StandaloneComponent
                ageGroup={activeChild.ageGroup}
                seed={standaloneExercise.seed}
                onComplete={handleStandaloneExerciseComplete}
                onCancel={handleSessionCancel}
              />
              {completedStandalone && (
                <ExerciseCompletionModal
                  exerciseId={completedStandalone.id}
                  result={completedStandalone.result}
                  onClose={handleCloseStandaloneModal}
                  onRestart={handleRestartStandalone}
                />
              )}
            </>
          )}
        </ErrorBoundary>
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
                    {EXERCISE_LABELS[id]}
                  </li>
                ))}
              </ul>
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
                onClick={handleStandaloneAssessment}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors"
              >
                Starten
              </button>
            </div>

            {exerciseSet.map((id) => (
              <div key={id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="text-5xl mb-4">{EXERCISE_ICONS[id]}</div>
                <h3 className="text-2xl font-bold mb-2">{EXERCISE_LABELS[id]}</h3>
                <p className="text-slate-600 mb-6 flex-1 text-sm">
                  Freies Üben außerhalb des Studienablaufs — wird nicht als Trainingstag gespeichert.
                </p>
                <button
                  onClick={() => handleStandaloneExercise(id)}
                  className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-colors"
                >
                  Starten
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === TABS.PROGRESS && (
          <div className="space-y-6">
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
            </div>

            <ChildDashboard uid={uid} child={activeChild} />
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
