import React from 'react';
import { X, Volume2, Subtitles, Check } from 'lucide-react';
import { MediaTrack } from '../../types/iptv';

interface AudioSubtitleSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  currentAudioId: number;
  currentSubtitleId: number;
  onSelectAudio: (id: number) => void;
  onSelectSubtitle: (id: number) => void;
}

export const AudioSubtitleSelector: React.FC<AudioSubtitleSelectorProps> = ({
  isOpen,
  onClose,
  audioTracks,
  subtitleTracks,
  currentAudioId,
  currentSubtitleId,
  onSelectAudio,
  onSelectSubtitle,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 z-50 bg-[#141419]/95 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <h3 className="text-base font-bold text-white flex items-center space-x-2">
          <span>Audio & Subtitles</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {/* Audio Tracks */}
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>Audio Stream</span>
          </div>
          <div className="space-y-1.5">
            {audioTracks.length === 0 ? (
              <div className="p-3 rounded-xl bg-white/5 text-xs text-zinc-400">
                Default Stereo / Passthrough
              </div>
            ) : (
              audioTracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => onSelectAudio(track.id)}
                  className={`w-full p-3 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                    track.id === currentAudioId
                      ? 'bg-cyan-500 text-black'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-200'
                  }`}
                >
                  <span>{track.name} ({track.lang.toUpperCase()})</span>
                  {track.id === currentAudioId && <Check className="w-4 h-4" />}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Subtitles */}
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            <Subtitles className="w-4 h-4 text-cyan-400" />
            <span>Subtitles</span>
          </div>
          <div className="space-y-1.5">
            <button
              onClick={() => onSelectSubtitle(-1)}
              className={`w-full p-3 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                currentSubtitleId === -1
                  ? 'bg-cyan-500 text-black'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-200'
              }`}
            >
              <span>Off (Disabled)</span>
              {currentSubtitleId === -1 && <Check className="w-4 h-4" />}
            </button>
            {subtitleTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => onSelectSubtitle(track.id)}
                className={`w-full p-3 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                  track.id === currentSubtitleId
                    ? 'bg-cyan-500 text-black'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-200'
                }`}
              >
                <span>{track.name} ({track.lang.toUpperCase()})</span>
                {track.id === currentSubtitleId && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
      >
        Done
      </button>
    </div>
  );
};
