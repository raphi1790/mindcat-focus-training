import { useState, useRef, useEffect } from 'react';

export default function HoldToExit({ onExit }) {
  const [isHolding, setIsHolding] = useState(false);
  const timeoutRef = useRef(null);

  const startHold = (e) => {
    // Prevent default context menu on long press on mobile
    if (e.type === 'touchstart') {
      e.preventDefault();
    }
    setIsHolding(true);
    timeoutRef.current = setTimeout(() => {
      onExit();
    }, 3000); // 3 seconds
  };

  const cancelHold = () => {
    setIsHolding(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="absolute top-6 right-6 z-50 flex items-center justify-center cursor-pointer touch-none"
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      title="3 Sekunden gedrückt halten, um zu beenden"
    >
      {/* Background Circle */}
      <svg className="w-16 h-16 absolute opacity-30 text-slate-400" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" />
      </svg>
      
      {/* Progress Circle */}
      <svg 
        className="w-16 h-16 absolute -rotate-90 text-red-500" 
        viewBox="0 0 100 100"
      >
        <circle 
          cx="50" cy="50" r="45" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="6"
          strokeDasharray="283"
          strokeDashoffset={isHolding ? "0" : "283"}
          className={`transition-all ease-linear ${isHolding ? 'duration-[3000ms]' : 'duration-300'}`}
        />
      </svg>

      {/* X Icon */}
      <div className={`relative z-10 text-2xl font-bold transition-colors ${isHolding ? 'text-red-500' : 'text-slate-400'}`}>
        ✕
      </div>
    </div>
  );
}
