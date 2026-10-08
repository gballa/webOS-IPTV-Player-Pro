/**
 * VoiceSearchService
 * 
 * Provides robust Voice-to-Text capabilities utilizing the Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Built specifically for TV remotes with integrated microphones (e.g., LG Magic Remote,
 * Android TV / Apple TV / Desktop microphone remotes).
 * 
 * Features:
 * - Detects browser/webOS microphone availability and SpeechRecognition support.
 * - Handles mic permission requests, interim transcript streaming, and final recognition.
 * - Fallbacks and informative user guidance when voice input is not supported or permission is denied.
 * - Auto-silence timeout and clean lifecycle teardown.
 */

export interface VoiceSearchState {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  confidence: number;
}

export type VoiceStateListener = (state: VoiceSearchState) => void;

// Declarations for browser SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export class VoiceSearchService {
  private static recognition: any = null;
  private static listeners: VoiceStateListener[] = [];
  private static currentState: VoiceSearchState = {
    isSupported: false,
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    confidence: 0,
  };

  /**
   * Check if speech recognition is supported in this browser/device
   */
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Initialize speech recognition engine
   */
  private static getRecognitionInstance(): any {
    if (this.recognition) return this.recognition;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      return null;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false; // TV queries are single phrases like "CNN" or "Action movies"
      rec.interimResults = true; // Stream interim results while user speaks into remote
      rec.maxAlternatives = 3;
      rec.lang = navigator.language || 'en-US';

      rec.onstart = () => {
        this.updateState({
          isListening: true,
          error: null,
          interimTranscript: '',
        });
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        let highestConfidence = 0;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcriptText = item[0]?.transcript || '';
          const confidence = item[0]?.confidence || 0;

          if (item.isFinal) {
            final += transcriptText;
            highestConfidence = Math.max(highestConfidence, confidence);
          } else {
            interim += transcriptText;
          }
        }

        this.updateState({
          transcript: final ? final.trim() : this.currentState.transcript,
          interimTranscript: interim.trim(),
          confidence: highestConfidence || this.currentState.confidence,
        });
      };

      rec.onerror = (event: any) => {
        let errorMsg = 'Voice recognition error';
        if (event.error === 'not-allowed') {
          errorMsg = 'Microphone permission denied. Check LG webOS / browser mic access.';
        } else if (event.error === 'no-speech') {
          errorMsg = 'No speech detected. Speak clearly into the Magic Remote.';
        } else if (event.error === 'network') {
          errorMsg = 'Network error during voice processing.';
        } else if (event.error === 'audio-capture') {
          errorMsg = 'No microphone device found on TV remote.';
        } else if (event.error) {
          errorMsg = `Voice error: ${event.error}`;
        }

        this.updateState({
          isListening: false,
          error: errorMsg,
        });
      };

      rec.onend = () => {
        this.updateState({
          isListening: false,
        });
      };

      this.recognition = rec;
      return rec;
    } catch (err: any) {
      console.warn('[VoiceSearchService] Initialization failed:', err);
      return null;
    }
  }

  /**
   * Start listening for speech input from the remote microphone
   */
  static startListening(
    onFinalResult?: (text: string) => void,
    lang?: string
  ): boolean {
    const isSupp = this.isSupported();
    if (!isSupp) {
      this.updateState({
        isSupported: false,
        error: 'Web Speech API is not supported on this browser/firmware.',
      });
      return false;
    }

    const rec = this.getRecognitionInstance();
    if (!rec) {
      this.updateState({
        isSupported: false,
        error: 'Could not create SpeechRecognition instance.',
      });
      return false;
    }

    if (lang) {
      rec.lang = lang;
    }

    // Attach custom onresult listener for final text
    if (onFinalResult) {
      const prevOnResult = rec.onresult;
      rec.onresult = (event: any) => {
        if (prevOnResult) prevOnResult(event);
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0]?.transcript?.trim();
            if (final) {
              onFinalResult(final);
            }
          }
        }
      };
    }

    try {
      this.updateState({
        isListening: true,
        transcript: '',
        interimTranscript: '',
        error: null,
      });
      rec.start();
      return true;
    } catch (err: any) {
      // Often thrown if recognition is already started
      if (err.name === 'InvalidStateError') {
        rec.stop();
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            // Ignore
          }
        }, 150);
        return true;
      }
      this.updateState({
        isListening: false,
        error: err.message || 'Failed to start microphone listening',
      });
      return false;
    }
  }

  /**
   * Stop speech listening
   */
  static stopListening(): void {
    if (this.recognition && this.currentState.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.updateState({ isListening: false });
  }

  /**
   * Abort current recognition immediately
   */
  static abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
    }
    this.updateState({
      isListening: false,
      interimTranscript: '',
    });
  }

  static subscribe(listener: VoiceStateListener): () => void {
    this.listeners.push(listener);
    // Send immediate initial state
    listener({ ...this.currentState, isSupported: this.isSupported() });

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  static getState(): VoiceSearchState {
    return { ...this.currentState, isSupported: this.isSupported() };
  }

  private static updateState(partial: Partial<VoiceSearchState>) {
    this.currentState = {
      ...this.currentState,
      ...partial,
      isSupported: this.isSupported(),
    };
    this.listeners.forEach(l => l(this.currentState));
  }
}
