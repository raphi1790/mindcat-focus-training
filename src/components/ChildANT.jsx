import React, { useState, useEffect, useCallback, useRef } from 'react';
import HoldToExit from './HoldToExit';
import { useInput } from '../utils/useInput';
import Fish from './Fish';

const CUES = ['none', 'central', 'double', 'spatial'];
const FLANKERS = ['neutral', 'congruent', 'incongruent'];
const POSITIONS = ['top', 'bottom'];
const DIRECTIONS = ['L', 'R'];

const PHASES = {
  INIT: 'INIT',
  INTER_BLOCK_PAUSE: 'INTER_BLOCK_PAUSE',
  FIXATION_1: 'FIXATION_1',
  CUE: 'CUE',
  ISI: 'ISI',
  TARGET: 'TARGET',
  FEEDBACK: 'FEEDBACK',
};

const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

// Generates exactly 48 trials (all combinations)
const generateBlockTrials = () => {
  const trials = [];
  for (let cue of CUES) {
    for (let flanker of FLANKERS) {
      for (let pos of POSITIONS) {
        for (let dir of DIRECTIONS) {
          trials.push({
            cue,
            flanker,
            position: pos,
            direction: dir,
            fixationTime: Math.floor(Math.random() * 1201) + 400 // 400 to 1600 ms
          });
        }
      }
    }
  }
  return shuffle(trials);
};

// Median calculation helper
const getMedian = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export default function ChildANT({ onComplete, title = "Child ANT" }) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0); // 0=Practice, 1-3=Test
  const [trials, setTrials] = useState([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [phase, setPhase] = useState(PHASES.INIT);
  const [results, setResults] = useState([]); // Stores all trials across all test blocks
  const [feedbackCorrect, setFeedbackCorrect] = useState(null); // true, false, null (missed)

  const startTimeRef = useRef(null);
  const timeoutRef = useRef(null);

  // Generate blocks
  const startNextBlock = useCallback(() => {
    let newTrials = generateBlockTrials();
    if (currentBlockIndex === 0) {
      // Practice block: only 24 trials
      newTrials = newTrials.slice(0, 24);
    }
    setTrials(newTrials);
    setCurrentTrialIndex(0);
    setPhase(PHASES.FIXATION_1);
  }, [currentBlockIndex]);

  // Start logic
  useEffect(() => {
    if (phase === PHASES.INIT) {
      startNextBlock();
    }
  }, [phase, startNextBlock]);

  // Handle Input
  const handleResponse = useCallback((dir) => {
    if (phase !== PHASES.TARGET) return;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const endTime = performance.now();
    const rt = endTime - startTimeRef.current;
    const currentTrial = trials[currentTrialIndex];
    
    let isCorrect = false;
    if (dir === currentTrial.direction) {
      isCorrect = true;
    } else if (dir === null) {
      isCorrect = null; // Missed
    }

    setFeedbackCorrect(isCorrect);
    
    // Save result if it's a test block (blockIndex > 0)
    if (currentBlockIndex > 0) {
      setResults(prev => [...prev, { ...currentTrial, rt, correct: isCorrect }]);
    }

    setPhase(PHASES.FEEDBACK);
  }, [phase, trials, currentTrialIndex, currentBlockIndex]);

  const handleGamepadMove = useCallback(({ dx }) => {
    if (phase !== PHASES.TARGET) return;
    if (dx < 0) handleResponse('L');
    if (dx > 0) handleResponse('R');
  }, [phase, handleResponse]);

  useInput(handleGamepadMove, phase === PHASES.TARGET, 1000);

  const finishTest = useCallback(() => {
    // Calculate ANT Scores based on Rueda (2004)
    // using median RTs for CORRECT trials only
    const correctTrials = results.filter(r => r.correct === true);
    
    const rtNoCue = getMedian(correctTrials.filter(r => r.cue === 'none').map(r => r.rt));
    const rtDoubleCue = getMedian(correctTrials.filter(r => r.cue === 'double').map(r => r.rt));
    const rtCentralCue = getMedian(correctTrials.filter(r => r.cue === 'central').map(r => r.rt));
    const rtSpatialCue = getMedian(correctTrials.filter(r => r.cue === 'spatial').map(r => r.rt));
    const rtIncongruent = getMedian(correctTrials.filter(r => r.flanker === 'incongruent').map(r => r.rt));
    const rtCongruent = getMedian(correctTrials.filter(r => r.flanker === 'congruent').map(r => r.rt));

    const alerting = rtNoCue - rtDoubleCue;
    const orienting = rtCentralCue - rtSpatialCue;
    const conflict = rtIncongruent - rtCongruent;
    
    const errors = results.filter(r => r.correct === false).length;
    const misses = results.filter(r => r.correct === null).length;
    const errorRate = results.length > 0 ? ((errors + misses) / results.length) * 100 : 0;

    onComplete({
      alerting,
      orienting,
      conflict,
      errorRate,
      rawResults: results
    });
  }, [results, onComplete]);

  // Advance to next phase
  const advancePhase = useCallback(() => {
    if (phase === PHASES.FIXATION_1) {
      setPhase(PHASES.CUE);
    } else if (phase === PHASES.CUE) {
      setPhase(PHASES.ISI);
    } else if (phase === PHASES.ISI) {
      setPhase(PHASES.TARGET);
      startTimeRef.current = performance.now();
    } else if (phase === PHASES.TARGET) {
      // If we reach here via timeout, it's a miss
      handleResponse(null);
    } else if (phase === PHASES.FEEDBACK) {
      if (currentTrialIndex + 1 < trials.length) {
        setCurrentTrialIndex(prev => prev + 1);
        setPhase(PHASES.FIXATION_1);
      } else {
        // Block completed
        if (currentBlockIndex < 3) {
          setCurrentBlockIndex(prev => prev + 1);
          setPhase(PHASES.INTER_BLOCK_PAUSE);
        } else {
          finishTest();
        }
      }
    }
  }, [phase, currentTrialIndex, trials.length, currentBlockIndex, handleResponse, finishTest]);

  // Timing logic
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    let delay = null;
    const currentTrial = trials[currentTrialIndex];

    if (phase === PHASES.FIXATION_1 && currentTrial) {
      delay = currentTrial.fixationTime;
    } else if (phase === PHASES.CUE) {
      delay = 150;
    } else if (phase === PHASES.ISI) {
      delay = 400;
    } else if (phase === PHASES.TARGET) {
      delay = 1700; // max allowed time
    } else if (phase === PHASES.FEEDBACK) {
      delay = 1000;
    }

    if (delay !== null) {
      timeoutRef.current = setTimeout(() => {
        advancePhase();
      }, delay);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, currentTrialIndex, trials, advancePhase]);

  // Rendering Helpers
  const renderFishRow = (trial) => {
    const { flanker, direction } = trial;
    const targetDir = direction;
    const flankerDir = flanker === 'incongruent' ? (direction === 'L' ? 'R' : 'L') : direction;
    
    const getTargetStatus = () => {
      if (phase !== PHASES.FEEDBACK) return 'neutral';
      if (feedbackCorrect === true) return 'success';
      if (feedbackCorrect === false || feedbackCorrect === null) return 'error';
      return 'neutral';
    };

    const getFish = (dir, isTarget) => (
      <Fish 
        key={Math.random()} 
        direction={dir} 
        status={isTarget ? getTargetStatus() : 'neutral'} 
        className="mx-1" 
      />
    );

    if (flanker === 'neutral') {
      return (
        <div className="flex h-24 items-center justify-center">
          <div className="w-24 mx-1 opacity-0"></div><div className="w-24 mx-1 opacity-0"></div>
          {getFish(targetDir, true)}
          <div className="w-24 mx-1 opacity-0"></div><div className="w-24 mx-1 opacity-0"></div>
        </div>
      );
    } else {
      return (
        <div className="flex h-24 items-center justify-center">
          {getFish(flankerDir, false)}
          {getFish(flankerDir, false)}
          {getFish(targetDir, true)}
          {getFish(flankerDir, false)}
          {getFish(flankerDir, false)}
        </div>
      );
    }
  };

  if (phase === PHASES.INTER_BLOCK_PAUSE) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full h-screen fixed inset-0 z-40 bg-blue-50">
        <HoldToExit onExit={() => onComplete({ cancel: true })} />
        <div className="text-center p-8 bg-white rounded-3xl shadow-sm border border-slate-100 max-w-lg">
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Super gemacht!</h2>
          <p className="text-xl text-slate-600 mb-8">Ruh dich kurz aus. Sag Bescheid, wenn du bereit für die nächste Runde bist.</p>
          <button 
            onClick={startNextBlock}
            className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl"
          >
            Weiter geht's!
          </button>
        </div>
      </div>
    );
  }

  const currentTrial = trials[currentTrialIndex];
  if (!currentTrial && phase !== PHASES.INIT) return null;

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full h-screen fixed inset-0 z-40 bg-cyan-600 relative overflow-hidden">
      <HoldToExit onExit={() => onComplete({ cancel: true })} />

      {/* Beta HUD */}
      <div className="absolute top-8 left-8 text-xl font-bold text-slate-400">
        {currentBlockIndex === 0 ? 'Übung (Practice)' : `Test-Block ${currentBlockIndex} / 3`}
        <span className="ml-4 font-normal text-slate-300">Trial {currentTrialIndex + 1} / {trials.length}</span>
      </div>

      <div className="relative w-full h-[600px] flex flex-col items-center justify-center">
        
        {/* Top Area */}
        <div className="absolute top-0 h-48 w-full flex items-center justify-center">
          {phase === PHASES.CUE && (currentTrial.cue === 'double' || (currentTrial.cue === 'spatial' && currentTrial.position === 'top')) && (
            <div className="text-6xl text-yellow-400 animate-pulse">⭐</div>
          )}
          {phase === PHASES.TARGET && currentTrial.position === 'top' && renderFishRow(currentTrial)}
        </div>

        {/* Center Area */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-24 flex items-center justify-center">
          {phase === PHASES.CUE && currentTrial.cue === 'central' ? (
            <div className="text-6xl text-yellow-300 animate-pulse">⭐</div>
          ) : (
            <div className={`text-6xl font-light text-white ${phase === PHASES.FEEDBACK ? 'opacity-0' : 'opacity-100'}`}>+</div>
          )}
        </div>

        {/* Bottom Area */}
        <div className="absolute bottom-0 h-48 w-full flex items-center justify-center">
          {phase === PHASES.CUE && (currentTrial.cue === 'double' || (currentTrial.cue === 'spatial' && currentTrial.position === 'bottom')) && (
            <div className="text-6xl text-yellow-400 animate-pulse">⭐</div>
          )}
          {phase === PHASES.TARGET && currentTrial.position === 'bottom' && renderFishRow(currentTrial)}
        </div>

      </div>

    </div>
  );
}
