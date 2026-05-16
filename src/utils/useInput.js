import { useEffect, useRef } from 'react';

export function useInput(onMove, enabled = true, moveDelayMs = 200) {
  const keys = useRef({ ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false });
  const lastMoveTime = useRef(0);
  const requestRef = useRef();

  const enabledRef = useRef(enabled);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (keys.current.hasOwnProperty(e.key)) {
        // Prevent default scrolling for arrow keys
        e.preventDefault();
        keys.current[e.key] = true;
      }
    };
    
    const handleKeyUp = (e) => {
      if (keys.current.hasOwnProperty(e.key)) {
        keys.current[e.key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    const loop = (time) => {
      let dx = 0;
      let dy = 0;

      // 1. Keyboard
      if (keys.current.ArrowUp) dy -= 1;
      if (keys.current.ArrowDown) dy += 1;
      if (keys.current.ArrowLeft) dx -= 1;
      if (keys.current.ArrowRight) dx += 1;

      // 2. Gamepad
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let gp of gamepads) {
        if (!gp) continue;
        
        // Analog sticks
        const xAxis = gp.axes[0];
        const yAxis = gp.axes[1];
        const deadzone = 0.3;
        
        if (xAxis < -deadzone) dx = -1;
        if (xAxis > deadzone) dx = 1;
        if (yAxis < -deadzone) dy = -1;
        if (yAxis > deadzone) dy = 1;
        
        // D-Pad (Standard Mapping)
        if (gp.buttons[12]?.pressed) dy = -1; // UP
        if (gp.buttons[13]?.pressed) dy = 1;  // DOWN
        if (gp.buttons[14]?.pressed) dx = -1; // LEFT
        if (gp.buttons[15]?.pressed) dx = 1;  // RIGHT

        // Speedlink & Arcade Buttons mapping
        // Button 1 (Left Round), 3 (Left Triangle) -> Left
        // Button 0 (Right Round), 2 (Right Triangle) -> Right
        if (gp.buttons[1]?.pressed || gp.buttons[3]?.pressed) dx = -1;
        if (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed) dx = 1;
      }

      // Clamp to strict 8-way logic (-1, 0, 1)
      dx = Math.sign(dx);
      dy = Math.sign(dy);

      // Only execute logic if enabled
      if (enabledRef.current && (dx !== 0 || dy !== 0)) {
        if (time - lastMoveTime.current > moveDelayMs) {
          onMoveRef.current({ dx, dy });
          lastMoveTime.current = time;
        }
      } else if (dx === 0 && dy === 0) {
        // Reset timer if no input, ensuring immediate response on next input
        lastMoveTime.current = 0;
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [moveDelayMs]);
}
