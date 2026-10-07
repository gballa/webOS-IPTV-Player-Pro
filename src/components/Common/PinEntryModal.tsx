import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, X, ShieldAlert, Check, Delete, RotateCcw } from 'lucide-react';
import { globalRemote, RemoteEvent } from '../../services/RemoteController';

interface PinEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (temporaryUnlockSession?: boolean) => void;
  correctPin: string;
  title?: string;
  description?: string;
  targetName?: string;
}

export const PinEntryModal: React.FC<PinEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin,
  title = 'Parental Security Lock',
  description = 'Enter your 4-digit security PIN to access protected content.',
  targetName,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [keypadIndex, setKeypadIndex] = useState(0); // 0-9, 10: Clear, 11: Backspace

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setIsShaking(false);
      setKeypadIndex(0);
    }
  }, [isOpen]);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    setError(null);
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      if (newPin === correctPin) {
        // Success
        setTimeout(() => {
          onSuccess(rememberSession);
          onClose();
        }, 150);
      } else {
        // Error
        setError('Incorrect security PIN. Please try again.');
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 600);
      }
    }
  };

  const handleBackspace = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setPin('');
  };

  // TV Remote Listener
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      switch (event.action) {
        case 'NUMBER':
          if (event.numberKey !== undefined && event.numberKey >= 0 && event.numberKey <= 9) {
            handleDigit(event.numberKey.toString());
          }
          break;
        case 'BACK':
          onClose();
          break;
        case 'LEFT':
          setKeypadIndex((prev) => (prev > 0 ? prev - 1 : 11));
          break;
        case 'RIGHT':
          setKeypadIndex((prev) => (prev < 11 ? prev + 1 : 0));
          break;
        case 'UP':
          setKeypadIndex((prev) => (prev >= 3 ? prev - 3 : prev));
          break;
        case 'DOWN':
          setKeypadIndex((prev) => (prev <= 8 ? prev + 3 : prev));
          break;
        case 'ENTER':
          if (keypadIndex >= 0 && keypadIndex <= 8) {
            handleDigit((keypadIndex + 1).toString());
          } else if (keypadIndex === 9) {
            handleClear();
          } else if (keypadIndex === 10) {
            handleDigit('0');
          } else if (keypadIndex === 11) {
            handleBackspace();
          }
          break;
      }
    });

    return () => unsubscribe();
  }, [isOpen, pin, keypadIndex, correctPin, rememberSession]);

  // Physical Keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, correctPin, rememberSession]);

  if (!isOpen) return null;

  const keypadLayout = [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: 'Clear', action: handleClear, icon: <RotateCcw className="w-4 h-4" /> },
    { label: '0', value: '0' },
    { label: 'Del', action: handleBackspace, icon: <Delete className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl select-none p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl bg-[#0d0f18] border border-white/20 p-6 sm:p-7 shadow-2xl flex flex-col items-center space-y-5 transition-transform duration-200 ${
          isShaking ? 'translate-x-[-12px] ring-2 ring-red-500' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Lock Icon */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-zinc-400">Restricted Broadcast Access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tv-focusable p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content info */}
        <div className="text-center space-y-1 w-full px-2">
          {targetName && (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="truncate max-w-[280px]">{targetName}</span>
            </div>
          )}
          <p className="text-xs text-zinc-300 leading-relaxed">{description}</p>
        </div>

        {/* 4 Digit Display Pills */}
        <div className="flex items-center justify-center space-x-3.5 py-1">
          {[0, 1, 2, 3].map((idx) => {
            const hasDigit = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black font-mono transition-all duration-200 shadow-md ${
                  hasDigit
                    ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent)] text-[var(--tv-accent)] shadow-[var(--tv-accent-glow)] scale-105'
                    : 'bg-black/50 border-white/15 text-zinc-600'
                }`}
              >
                {hasDigit ? '●' : '—'}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-xl animate-fadeIn">
            {error}
          </div>
        )}

        {/* On-Screen Numeric Keypad (TV remote friendly) */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
          {keypadLayout.map((btn, idx) => {
            const isFocused = keypadIndex === idx;
            return (
              <button
                key={btn.label}
                ref={(el) => { buttonRefs.current[idx] = el; }}
                type="button"
                onClick={() => {
                  if (btn.action) {
                    btn.action();
                  } else if (btn.value) {
                    handleDigit(btn.value);
                  }
                }}
                className={`tv-focusable h-12 rounded-2xl font-mono text-base font-black flex items-center justify-center transition-all duration-150 cursor-pointer ${
                  isFocused
                    ? 'bg-[var(--tv-accent)] text-black ring-2 ring-white scale-105 shadow-lg shadow-[var(--tv-accent-glow)]'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/25'
                }`}
              >
                {btn.icon || btn.label}
              </button>
            );
          })}
        </div>

        {/* Session Unlock Option */}
        <div className="w-full pt-2 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <label className="flex items-center space-x-2 cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 accent-[var(--tv-accent)]"
            />
            <span className="text-[11px]">Keep unlocked for this session</span>
          </label>

          <span className="text-[10px] font-mono text-zinc-500">Remote: 0–9</span>
        </div>
      </div>
    </div>
  );
};
