import React, { useState } from 'react';

export default function SessionStartScreen({ onStart, onCancel }) {
  const [childId, setChildId] = useState('');
  const [error, setError] = useState('');

  const handleStart = (e) => {
    e.preventDefault();
    if (!childId.trim()) {
      setError('Bitte gib eine Probanden-ID ein.');
      return;
    }
    onStart(childId.trim());
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-200/30 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-200/30 blur-3xl"></div>
      </div>

      <div className="w-full max-w-lg bg-white p-12 rounded-[2rem] shadow-2xl shadow-purple-900/5 border border-white/50 relative z-10 backdrop-blur-xl">
        <button 
          onClick={onCancel}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-10">
          <span className="text-6xl block mb-6 drop-shadow-sm">🗓️</span>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Trainings-Plan Starten</h2>
          <p className="text-slate-500 font-medium">5-Tage Rueda (2005) Protokoll</p>
        </div>
        
        {error && (
          <div className="bg-red-50/80 backdrop-blur text-red-600 p-4 rounded-2xl mb-8 text-sm border border-red-100 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleStart} className="space-y-8">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3 ml-1">Probanden-ID / Kind-ID</label>
            <input 
              type="text" 
              value={childId}
              onChange={(e) => {
                setChildId(e.target.value);
                if (error) setError('');
              }}
              className="w-full px-5 py-4 text-lg rounded-2xl bg-slate-50 border-2 border-slate-200 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all placeholder:text-slate-400 font-medium"
              placeholder="z.B. PROB-001"
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-3 ml-1">Das System berechnet automatisch den aktuellen Trainingstag basierend auf bisherigen Sitzungen.</p>
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-lg py-4 rounded-2xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30 transform hover:-translate-y-0.5"
          >
            Sitzung vorbereiten
          </button>
        </form>
      </div>
    </div>
  );
}
