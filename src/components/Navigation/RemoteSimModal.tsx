import React from 'react';
import { X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft, Play, Pause, FastForward, Rewind } from 'lucide-react';
import { globalRemote, RemoteAction } from '../../services/RemoteController';

interface RemoteSimModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemoteSimModal: React.FC<RemoteSimModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const trigger = (action: RemoteAction, num?: number) => {
    globalRemote.emitSimulated(action, num);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-[#141419] border border-white/20 rounded-3xl p-6 w-[400px] shadow-2xl relative select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span>webOS Magic Remote Sim</span>
            </h3>
            <p className="text-xs text-zinc-400">Simulate physical LG remote buttons</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Remote Body */}
        <div className="py-4 space-y-4">
          {/* Numbers 1-9 & 0 */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => trigger('NUMBER', num)}
                className="py-2.5 bg-white/5 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-lg text-sm font-bold text-white transition-colors"
              >
                {num}
              </button>
            ))}
            <div className="flex items-center justify-center text-[10px] text-zinc-500">INFO</div>
            <button
              onClick={() => trigger('NUMBER', 0)}
              className="py-2.5 bg-white/5 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-lg text-sm font-bold text-white transition-colors"
            >
              0
            </button>
            <div className="flex items-center justify-center text-[10px] text-zinc-500">GUIDE</div>
          </div>

          {/* D-Pad Controller */}
          <div className="relative w-48 h-48 mx-auto my-2 rounded-full bg-[#1c1c24] border-2 border-white/15 p-2 shadow-inner flex items-center justify-center">
            {/* UP */}
            <button
              onClick={() => trigger('UP')}
              title="Remote Up"
              className="absolute top-2 left-1/2 -translate-x-1/2 p-2 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-full text-zinc-200"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
            {/* DOWN */}
            <button
              onClick={() => trigger('DOWN')}
              title="Remote Down"
              className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-full text-zinc-200"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            {/* LEFT */}
            <button
              onClick={() => trigger('LEFT')}
              title="Remote Left"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-full text-zinc-200"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            {/* RIGHT */}
            <button
              onClick={() => trigger('RIGHT')}
              title="Remote Right"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-full text-zinc-200"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            {/* CENTER OK */}
            <button
              onClick={() => trigger('ENTER')}
              title="Remote OK / Select"
              className="w-16 h-16 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-black font-extrabold text-sm flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-transform"
            >
              OK
            </button>
          </div>

          {/* Action Row: Back, Channel Up/Down */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => trigger('BACK')}
              className="py-2.5 px-3 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 active:bg-red-500 active:text-white rounded-lg text-xs font-bold text-red-300 flex items-center justify-center space-x-1"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>BACK</span>
            </button>
            <button
              onClick={() => trigger('CH_UP')}
              className="py-2.5 bg-white/5 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-lg text-xs font-bold text-zinc-200"
            >
              CH +
            </button>
            <button
              onClick={() => trigger('CH_DOWN')}
              className="py-2.5 bg-white/5 hover:bg-white/15 active:bg-cyan-500 active:text-black rounded-lg text-xs font-bold text-zinc-200"
            >
              CH -
            </button>
          </div>

          {/* Color Keys (webOS 403, 404, 405, 406) */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={() => trigger('RED')}
              className="py-2 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-[11px] font-bold text-white shadow-md shadow-red-600/20"
              title="Red Key: Open EPG"
            >
              EPG
            </button>
            <button
              onClick={() => trigger('GREEN')}
              className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-[11px] font-bold text-white shadow-md shadow-emerald-600/20"
              title="Green Key: Toggle Favorite"
            >
              FAV
            </button>
            <button
              onClick={() => trigger('YELLOW')}
              className="py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-[11px] font-bold text-black shadow-md shadow-yellow-500/20"
              title="Yellow Key: OSD Stream Info"
            >
              OSD
            </button>
            <button
              onClick={() => trigger('BLUE')}
              className="py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-[11px] font-bold text-white shadow-md shadow-blue-600/20"
              title="Blue Key: Settings"
            >
              SETUP
            </button>
          </div>

          {/* Media Playback Keys */}
          <div className="flex items-center justify-around pt-1 border-t border-white/10">
            <button
              onClick={() => trigger('REWIND')}
              title="Seek -10s"
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-300"
            >
              <Rewind className="w-4 h-4" />
            </button>
            <button
              onClick={() => trigger('PLAY')}
              title="Play"
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-300"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={() => trigger('PAUSE')}
              title="Pause (DVR timeshift)"
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-300"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              onClick={() => trigger('FAST_FORWARD')}
              title="Seek +10s"
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-300"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="pt-2 text-center text-[10px] text-zinc-500 border-t border-white/5">
          Tip: You can also use PC keyboard arrows, Enter, Backspace/Esc, and 0-9.
        </div>
      </div>
    </div>
  );
};
