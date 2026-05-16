import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import PreTestScreen from './components/PreTestScreen';
import ChildANT from './components/ChildANT';
import TrainingGrid from './components/TrainingGrid';
import MazeExercise from './components/MazeExercise';
import { saveSessionData, getTestResults } from './services/firebaseService';

const VIEWS = {
  DASHBOARD: 'DASHBOARD',
  PRE_TEST: 'PRE_TEST',
  CHILD_ANT: 'CHILD_ANT',
  SIDE_EXERCISE: 'SIDE_EXERCISE',
  MAZE_EXERCISE: 'MAZE_EXERCISE'
};

const TABS = {
  TESTS: 'TESTS',
  TRAINING: 'TRAINING',
  RESULTS: 'RESULTS'
};

export default function App() {
  const { currentUser, logout } = useAuth();
  
  const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);
  const [activeTab, setActiveTab] = useState(TABS.TESTS);
  
  const [activeSession, setActiveSession] = useState({ moduleToStart: null, childId: null });
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (activeTab === TABS.RESULTS && currentUser) {
      const loadResults = async () => {
        setLoadingResults(true);
        const data = await getTestResults(currentUser.uid);
        setResults(data);
        setLoadingResults(false);
      };
      loadResults();
    }
  }, [activeTab, currentUser]);

  if (!currentUser) {
    return <Login />;
  }

  const handleStartPreTest = (moduleName) => {
    setActiveSession({ moduleToStart: moduleName, childId: null });
    setCurrentView(VIEWS.PRE_TEST);
  };

  const handlePreTestSubmit = (childId) => {
    setActiveSession(prev => ({ ...prev, childId }));
    setCurrentView(activeSession.moduleToStart);
  };

  const handlePreTestCancel = () => {
    setActiveSession({ moduleToStart: null, childId: null });
    setCurrentView(VIEWS.DASHBOARD);
  };

  const handleModuleComplete = async (moduleName, data) => {
    if (!data.cancel) {
      const sessionData = {
        supervisorId: currentUser.uid,
        childId: activeSession.childId || 'anonymous',
        testType: moduleName,
        metrics: data
      };
      await saveSessionData(sessionData);
    }
    setActiveSession({ moduleToStart: null, childId: null });
    setCurrentView(VIEWS.DASHBOARD);
  };

  if (currentView !== VIEWS.DASHBOARD) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-hidden">
        {currentView === VIEWS.PRE_TEST && (
          <PreTestScreen 
            moduleName={
              Object.keys(VIEWS).find(k => VIEWS[k] === activeSession.moduleToStart)?.replace('_', ' ') || 'Test'
            }
            onStart={handlePreTestSubmit}
            onCancel={handlePreTestCancel}
          />
        )}
        {currentView === VIEWS.CHILD_ANT && (
          <ChildANT 
            title="Child ANT Test" 
            onComplete={(data) => handleModuleComplete('Child ANT', data)} 
          />
        )}
        {currentView === VIEWS.SIDE_EXERCISE && (
          <TrainingGrid 
            onComplete={(data) => handleModuleComplete('Side Exercise', data)} 
          />
        )}
        {currentView === VIEWS.MAZE_EXERCISE && (
          <MazeExercise 
            onComplete={(data) => handleModuleComplete('Maze Exercise', data)} 
          />
        )}
      </div>
    );
  }

  // Dashboard Mode
  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800">
      
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-900 text-white flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10">
          <span className="text-3xl">🧠</span>
          <h1 className="text-xl font-bold leading-tight">Focus<br/>Dashboard</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab(TABS.TESTS)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === TABS.TESTS ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            📋 Tests
          </button>
          
          <button 
            onClick={() => setActiveTab(TABS.TRAINING)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === TABS.TRAINING ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            🎮 Übungen
          </button>

          <button 
            onClick={() => setActiveTab(TABS.RESULTS)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === TABS.RESULTS ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            📊 Resultate
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="text-sm font-medium text-slate-300 mb-4 truncate" title={currentUser.email}>
            👤 {currentUser.email}
          </div>
          <button 
            onClick={logout}
            className="w-full bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 transition-colors py-2 rounded-lg text-sm font-medium border border-slate-700 hover:border-red-900/50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-12 relative">
        <header className="mb-12">
          <h2 className="text-4xl font-bold text-slate-800">
            {activeTab === TABS.TESTS && "Diagnostik & Tests"}
            {activeTab === TABS.TRAINING && "Trainings-Module"}
            {activeTab === TABS.RESULTS && "Auswertung"}
          </h2>
          <p className="text-slate-500 mt-2 text-lg">
            {activeTab !== TABS.RESULTS 
              ? "Wähle ein Modul aus und starte es im Kiosk-Modus für das Kind."
              : "Übersicht aller absolvierten Tests und Übungen."}
          </p>
        </header>

        {activeTab === TABS.TESTS && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div className="text-5xl mb-4">🐟</div>
              <h3 className="text-2xl font-bold mb-2">Child ANT</h3>
              <p className="text-slate-600 mb-6 flex-1">
                Klassischer Flanker-Test zur Messung der exekutiven Aufmerksamkeit. Das Kind muss per Pfeiltaste bestimmen, in welche Richtung der mittlere Fisch zeigt. (24 Durchläufe)
              </p>
              <button 
                onClick={() => handleStartPreTest(VIEWS.CHILD_ANT)}
                className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors"
              >
                Test Starten
              </button>
            </div>
          </div>
        )}

        {activeTab === TABS.TRAINING && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div className="text-5xl mb-4">🐱</div>
              <h3 className="text-2xl font-bold mb-2">Side Exercise</h3>
              <p className="text-slate-600 mb-6 flex-1">
                Freie Navigation auf einem 10x10 Raster. Das Zielgebiet (Gras) befindet sich an den Rändern. Mit jedem Level weitet sich der Schlamm aus. Nutzt Joystick (8-Wege) oder Tastatur.
              </p>
              <button 
                onClick={() => handleStartPreTest(VIEWS.SIDE_EXERCISE)}
                className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-colors"
              >
                Side Exercise Starten
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
              <div className="text-5xl mb-4">🧩</div>
              <h3 className="text-2xl font-bold mb-2">Maze Exercise</h3>
              <p className="text-slate-600 mb-6 flex-1">
                Labyrinth-Training auf einem 15x15 Raster. Erfordert motorische Antizipation durch Kurven und Abzweigungen. Nutzt Joystick (8-Wege) oder Tastatur.
              </p>
              <button 
                onClick={() => handleStartPreTest(VIEWS.MAZE_EXERCISE)}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Maze Exercise Starten
              </button>
            </div>
          </div>
        )}

        {activeTab === TABS.RESULTS && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            {loadingResults ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <h3 className="text-xl font-medium text-slate-500">Lade Resultate...</h3>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📊</span>
                <h3 className="text-xl font-bold text-slate-400">Noch keine Resultate</h3>
                <p className="text-slate-400 mt-2">Absolviere einen Test oder eine Übung, um hier Daten zu sehen.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-100">
                      <th className="py-3 px-4 text-slate-500">Datum</th>
                      <th className="py-3 px-4 text-slate-500">Kind-ID</th>
                      <th className="py-3 px-4 text-slate-500">Modul</th>
                      <th className="py-3 px-4 text-slate-500">Score / Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.id || i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(r.timestamp).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs">{r.childId}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{r.testType}</td>
                        <td className="py-3 px-4 font-mono text-sm">
                          {r.testType === 'Child ANT' ? (
                            <div className="flex gap-3 text-xs">
                              <div className="flex flex-col items-center">
                                <span className="text-slate-400 uppercase text-[10px]">Alert</span>
                                <span className="font-bold text-blue-600">{Math.round(r.metrics?.alerting || 0)}</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-slate-200 pl-3">
                                <span className="text-slate-400 uppercase text-[10px]">Orient</span>
                                <span className="font-bold text-green-600">{Math.round(r.metrics?.orienting || 0)}</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-slate-200 pl-3">
                                <span className="text-slate-400 uppercase text-[10px]">Conflict</span>
                                <span className="font-bold text-red-600">{Math.round(r.metrics?.conflict || 0)}</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-slate-200 pl-3">
                                <span className="text-slate-400 uppercase text-[10px]">Error</span>
                                <span className="font-bold text-slate-600">{r.metrics?.errorRate?.toFixed(1) || 0}%</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">
                              Level: <span className="font-bold">{r.metrics?.highestLevelReached || 1}</span>, 
                              Errors: <span className="font-bold">{r.metrics?.errors || 0}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
