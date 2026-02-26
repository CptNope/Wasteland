import React, { useEffect, useRef, useState } from 'react';
import { GameApp } from '../game/GameApp';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let game: GameApp | null = null;
    if (canvasRef.current && isPlaying) {
      game = new GameApp(canvasRef.current);
    }
    
    // Cleanup
    return () => {
      if (game) {
        game.dispose();
      }
    };
  }, [isPlaying]);

  const handleStart = () => {
    setIsPlaying(true);
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      {!isPlaying && (
        <div 
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white cursor-pointer"
          onClick={handleStart}
        >
          <h1 className="text-6xl font-bold mb-4 text-red-600 tracking-widest">WASTELAND</h1>
          <p className="text-2xl mb-8 animate-pulse">CLICK TO SURVIVE</p>
          
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm border border-white/20">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">CONTROLS</h2>
            <ul className="space-y-2 text-sm font-mono">
              <li><span className="font-bold text-white">W A S D</span> - Move</li>
              <li><span className="font-bold text-white">SHIFT</span> - Sprint</li>
              <li><span className="font-bold text-white">SPACE</span> - Jump</li>
              <li><span className="font-bold text-white">MOUSE</span> - Look</li>
              <li><span className="font-bold text-white">L-CLICK</span> - Shoot</li>
              <li><span className="font-bold text-white">R</span> - Reload</li>
            </ul>
          </div>
        </div>
      )}
      
      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none" 
        id="renderCanvas"
      />
      
      {isPlaying && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white/50 pointer-events-none text-xs font-mono">
          SURVIVE THE HORDE
        </div>
      )}
    </div>
  );
}
