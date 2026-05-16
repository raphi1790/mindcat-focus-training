import React, { useState } from 'react';
import ChildANT from './components/ChildANT';
import TrainingGrid from './components/TrainingGrid';
import MazeExercise from './components/MazeExercise';

const VIEWS = {
  DASHBOARD: 'DASHBOARD',
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
  const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);
  const [activeTab, setActiveTab] = useState(TABS.TESTS);
  
  // Minimal state to store results locally for now
  const [results, setResults] = useState([]);

  const handleModuleComplete = (moduleName, data) => {
    if (!data.cancel) {
      setResults(prev => [...prev, { module: moduleName, date: new Date().toLocaleString(), ...data }]);
    }
    setCurrentView(VIEWS.DASHBOARD);
  };

  if (currentView !== VIEWS.DASHBOARD) {
    // Kiosk Mode: Render module fullscreen
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-hidden">
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

        <div className="mt-auto text-xs text-slate-500">
          <p>Gamepad API aktiv.</p>
          <p>Joystick vor Start bewegen.</p>
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
            Wähle ein Modul aus und starte es im Kiosk-Modus für das Kind.
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
                onClick={() => setCurrentView(VIEWS.CHILD_ANT)}
                className="w-full bg-[var(--color-primary)] text-white font-bold py-3 rounded-xl hover:bg-purple-600 transition-colors"
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
                onClick={() => setCurrentView(VIEWS.SIDE_EXERCISE)}
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
                onClick={() => setCurrentView(VIEWS.MAZE_EXERCISE)}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                Maze Exercise Starten
              </button>
            </div>
          </div>
        )}

        {activeTab === TABS.RESULTS && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            {results.length === 0 ? (
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
                      <th className="py-3 px-4 text-slate-500">Zeitpunkt</th>
                      <th className="py-3 px-4 text-slate-500">Modul</th>
                      <th className="py-3 px-4 text-slate-500">Score / Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-3 px-4">{r.date}</td>
                        <td className="py-3 px-4 font-medium">{r.module}</td>
                        <td className="py-3 px-4 font-mono text-sm">
                          {r.module === 'Child ANT' ? (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="text-slate-400 block uppercase text-[10px]">Alerting</span>
                                <span className="font-bold text-blue-700">{Math.round(r.alerting)}ms</span>
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <span className="text-slate-400 block uppercase text-[10px]">Orienting</span>
                                <span className="font-bold text-green-700">{Math.round(r.orienting)}ms</span>
                              </div>
                              <div className="bg-red-50 p-2 rounded">
                                <span className="text-slate-400 block uppercase text-[10px]">Conflict</span>
                                <span className="font-bold text-red-700">{Math.round(r.conflict)}ms</span>
                              </div>
                              <div className="bg-slate-50 p-2 rounded">
                                <span className="text-slate-400 block uppercase text-[10px]">Error Rate</span>
                                <span className="font-bold text-slate-700">{r.errorRate?.toFixed(1)}%</span>
                              </div>
                            </div>
                          ) : (
                            <span>Level: {r.highestLevelReached}, Errors: {r.errors}</span>
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
