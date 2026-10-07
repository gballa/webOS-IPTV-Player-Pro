import React, { useEffect, useState } from 'react';

interface NumberOverlayProps {
  inputBuffer: string;
}

export const NumberOverlay: React.FC<NumberOverlayProps> = ({ inputBuffer }) => {
  if (!inputBuffer) return null;

  return (
    <div className="fixed top-12 right-12 z-50 pointer-events-none">
      <div className="flex items-center space-x-3 px-6 py-4 rounded-2xl bg-black/90 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/40 backdrop-blur-md animate-bounce">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Channel</span>
        <span className="text-4xl font-black text-white font-mono tracking-widest">{inputBuffer}</span>
      </div>
    </div>
  );
};
