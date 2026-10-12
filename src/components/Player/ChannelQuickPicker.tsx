import React from 'react';
import { X, Radio, Heart } from 'lucide-react';
import { Channel } from '../../types/iptv';
import { VirtualList } from '../Common/VirtualList';

interface ChannelQuickPickerProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  currentChannelId: string;
  onSelectChannel: (channel: Channel) => void;
  favoriteIds: string[];
}

export const ChannelQuickPicker: React.FC<ChannelQuickPickerProps> = ({
  isOpen,
  onClose,
  channels,
  currentChannelId,
  onSelectChannel,
  favoriteIds,
}) => {
  if (!isOpen) return null;

  const currentIdx = channels.findIndex(c => c.id === currentChannelId);
  const [rootFs, setRootFs] = React.useState(16);

  React.useEffect(() => {
    const updateFs = () => {
      const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (!isNaN(fs) && fs > 0) setRootFs(fs);
    };
    updateFs();
    window.addEventListener('resize', updateFs);
    return () => window.removeEventListener('resize', updateFs);
  }, []);

  return (
    <div className="fixed inset-y-0 left-0 w-[clamp(18rem,24vw,28rem)] z-50 bg-[#0e0e13]/95 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <Radio className="w-5 h-5 text-[var(--tv-accent)]" />
          <h3 className="text-base font-bold text-white">Channel Switcher</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 mt-4 overflow-hidden">
        <VirtualList
          items={channels}
          itemHeight={Math.round(4 * rootFs)}
          viewportHeight={600}
          focusedIndex={currentIdx}
          renderItem={(ch, _, isFocused) => {
            const isCurrent = ch.id === currentChannelId;
            const isFav = favoriteIds.includes(ch.id);

            return (
              <div
                onClick={() => {
                  onSelectChannel(ch);
                  onClose();
                }}
                className={`mx-1 p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                  isCurrent
                    ? 'bg-[var(--tv-accent)] text-black font-bold shadow-md shadow-[var(--tv-accent-glow)]'
                    : isFocused
                    ? 'bg-white/20 text-white'
                    : 'hover:bg-white/10 text-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1 overflow-hidden pr-2">
                  <span className={`text-xs font-mono font-black shrink-0 ${isCurrent ? 'text-black' : 'text-[var(--tv-accent)]'}`}>
                    #{ch.num.toString().padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden leading-tight">
                    <div className="text-sm truncate whitespace-nowrap font-bold">{ch.name}</div>
                    <div className={`text-[0.6875rem] truncate whitespace-nowrap mt-0.5 ${isCurrent ? 'text-black/80' : 'text-zinc-400'}`}>
                      {ch.group}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {ch.resolution === '4K' && (
                    <span className="px-1.5 py-0.5 rounded bg-black/30 text-[0.625rem] font-black uppercase">
                      4K
                    </span>
                  )}
                  {isFav && <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />}
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};
