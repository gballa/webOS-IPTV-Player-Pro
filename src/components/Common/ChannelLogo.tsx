import React, { useState, useEffect } from 'react';
import { ChannelLogoService } from '../../services/ChannelLogoService';

interface ChannelLogoProps {
  channelName: string;
  logoUrl?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const ChannelLogo: React.FC<ChannelLogoProps> = ({
  channelName,
  logoUrl,
  className = '',
  size = 'sm',
}) => {
  const [loadError, setLoadError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(false);
    // 1. Try provided safe logo URL
    const safeUrl = ChannelLogoService.getSafeLogoUrl(logoUrl);
    if (safeUrl) {
      setCurrentSrc(safeUrl);
      return;
    }

    // 2. Try known channel logo match
    const matched = ChannelLogoService.matchKnownLogo(channelName);
    if (matched) {
      setCurrentSrc(matched);
      return;
    }

    setCurrentSrc(null);
  }, [channelName, logoUrl]);

  const handleImageError = () => {
    // If the primary logo failed, try known channel logo fallback once before monogram
    const matched = ChannelLogoService.matchKnownLogo(channelName);
    if (matched && currentSrc !== matched) {
      setCurrentSrc(matched);
      return;
    }
    setLoadError(true);
  };

  // Dimensions mapping
  const sizeClasses = {
    xs: 'w-5 h-5 text-[9px] rounded-md',
    sm: 'w-7 h-7 text-[10px] rounded-lg',
    md: 'w-9 h-9 text-xs rounded-xl',
    lg: 'w-12 h-12 text-sm rounded-2xl',
  };

  // Fallback monogram
  if (!currentSrc || loadError) {
    const { initials, gradient } = ChannelLogoService.getMonogram(channelName);
    return (
      <div
        className={`${sizeClasses[size]} shrink-0 bg-gradient-to-br ${gradient} p-0.5 border border-white/20 shadow-inner flex items-center justify-center font-black tracking-wider text-white select-none ${className}`}
        title={channelName}
      >
        <span className="drop-shadow-sm font-mono uppercase">{initials}</span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} shrink-0 bg-black/60 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden select-none ${className}`}
      title={channelName}
    >
      <img
        src={currentSrc}
        alt={channelName}
        loading="lazy"
        onError={handleImageError}
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-200"
      />
    </div>
  );
};
