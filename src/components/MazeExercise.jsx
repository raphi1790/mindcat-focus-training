import React, { useState, useCallback } from 'react';
import { useInput } from '../utils/useInput';
import HoldToExit from './HoldToExit';

const MAZE_MAPS = {
  1: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,0,0,0,3,0,0,0,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  2: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,1,1,1,1,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,0,1,1,1,3,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  3: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,2,0,0,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,0,0,0,0,0,0,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,0,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,1,1,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,0,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,0,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,1,1,1,3,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ]
};

const getStartPosition = (level) => {
  const map = MAZE_MAPS[level];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (map[y][x] === 3) return { x, y };
    }
  }
  return { x: 7, y: 7 }; 
};

export default function MazeExercise({ onComplete }) {
  const [level, setLevel] = useState(1);
  const [catPos, setCatPos] = useState(getStartPosition(1));
  const [consecutiveSuccess, setConsecutiveSuccess] = useState(0);
  const [totalTrials, setTotalTrials] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState(null); 
  
  const map = MAZE_MAPS[level];

  const handleTrialEnd = useCallback((isSuccess) => {
    setTotalTrials(prev => prev + 1);
    
    if (isSuccess) {
      setFlash('green');
      const newSuccessCount = consecutiveSuccess + 1;
      
      if (newSuccessCount >= 3) {
        if (level < 3) {
          setLevel(prev => prev + 1);
          setConsecutiveSuccess(0);
        } else {
          setConsecutiveSuccess(newSuccessCount);
          if (totalTrials + 1 >= 9) { // Shortened requirements for maze (9 trials total for 3 levels)
            setTimeout(() => {
              onComplete({ highestLevelReached: 3, totalTrials: totalTrials + 1, errors });
            }, 1000);
            return;
          }
        }
      } else {
        setConsecutiveSuccess(newSuccessCount);
      }
    } else {
      setFlash('red');
      setErrors(prev => prev + 1);
      setConsecutiveSuccess(0);
    }

    setTimeout(() => {
      setFlash(null);
      setLevel(currentLevel => {
        setCatPos(getStartPosition(currentLevel));
        return currentLevel;
      });
    }, 500);
  }, [consecutiveSuccess, level, totalTrials, errors, onComplete]);

  const handleMove = useCallback(({ dx, dy }) => {
    if (flash !== null) return; 

    const nx = catPos.x + dx;
    const ny = catPos.y + dy;

    if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
      // Diagonal clipping logic
      if (dx !== 0 && dy !== 0) {
        const tileX = map[catPos.y][nx];
        const tileY = map[ny][catPos.x];
        if (tileX === 1 && tileY === 1) {
          handleTrialEnd(false); 
          return;
        }
      }

      setCatPos({ x: nx, y: ny });
      
      const tile = map[ny][nx];
      if (tile === 1) {
        handleTrialEnd(false); 
      } else if (tile === 2) {
        handleTrialEnd(true); 
      }
    }
  }, [catPos, map, flash, handleTrialEnd]);

  useInput(handleMove, flash === null, 150);

  const renderCell = (x, y) => {
    const isCat = catPos.x === x && catPos.y === y;
    const tile = map[y][x];
    
    let cellClass = "w-full h-full border border-slate-200/10 flex items-center justify-center text-xl sm:text-2xl transition-all duration-200";
    
    if (tile === 1) {
      cellClass += " bg-[var(--color-mud)]";
    } else if (tile === 2) {
      cellClass += " bg-[var(--color-grass)]";
    } else {
      cellClass += " bg-amber-50"; 
    }

    return (
      <div key={`${x}-${y}`} className={cellClass}>
        {isCat && <span className="animate-bounce">🐱</span>}
      </div>
    );
  };

  return (
    <div className={`flex flex-col items-center justify-center flex-1 w-full h-screen fixed inset-0 z-40 transition-colors duration-300 ${flash === 'red' ? 'bg-red-200' : flash === 'green' ? 'bg-green-200' : 'bg-slate-100'}`}>
      <HoldToExit onExit={() => onComplete({ cancel: true })} />
      
      <div className="absolute top-8 left-8 text-2xl font-bold text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm">
        Labyrinth {level} <span className="text-sm font-normal text-slate-400 ml-2">({consecutiveSuccess}/3 für Aufstieg)</span>
      </div>

      <div className="absolute top-8 right-24 text-xl font-medium text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm">
        Durchläufe: {totalTrials} / 9
      </div>

      <div className="mt-16 w-[95vw] max-w-[700px] aspect-square grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(15,1fr)] shadow-2xl rounded-2xl overflow-hidden border-4 border-white">
        {Array.from({ length: 15 }).map((_, y) => 
          Array.from({ length: 15 }).map((_, x) => renderCell(x, y))
        )}
      </div>

      <div className="mt-8 text-center text-slate-500 text-xl font-medium max-w-lg">
        Navigiere durch das Labyrinth zum Gras (🟩).<br/>
        <span className="text-red-500 font-bold">Achtung: Joystick-Diagonale erfordert Vorsicht an den Ecken!</span>
      </div>

    </div>
  );
}
