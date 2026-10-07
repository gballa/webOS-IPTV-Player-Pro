export type RemoteAction =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'ENTER'
  | 'BACK'
  | 'RED'     // EPG
  | 'GREEN'   // Favorite
  | 'YELLOW'  // Search / Info
  | 'BLUE'    // Settings
  | 'CH_UP'
  | 'CH_DOWN'
  | 'PLAY'
  | 'PAUSE'
  | 'PLAY_PAUSE'
  | 'FAST_FORWARD'
  | 'REWIND'
  | 'STOP'
  | 'NUMBER'
  | 'GUIDE'
  | 'INFO';

export interface RemoteEvent {
  action: RemoteAction;
  numberKey?: number;
  originalEvent: KeyboardEvent;
}

export class RemoteController {
  private listeners: ((event: RemoteEvent) => void)[] = [];

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown, true);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown, true);
    }
    this.listeners = [];
  }

  subscribe(listener: (event: RemoteEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Directly dispatch simulated remote button clicks (from on-screen remote or touch)
   */
  emitSimulated(action: RemoteAction, numberKey?: number) {
    const fakeEvent = new KeyboardEvent('keydown', { key: action });
    this.listeners.forEach(cb => cb({ action, numberKey, originalEvent: fakeEvent }));
  }

  private handleKeyDown(e: KeyboardEvent) {
    const code = e.keyCode || e.which;
    const key = e.key;

    // Don't intercept if user is actively typing in an input or textarea
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      if (code === 27 || code === 461) {
        // Allow BACK to blur input
        (active as HTMLElement).blur();
        e.preventDefault();
        return;
      }
      return;
    }

    let action: RemoteAction | null = null;
    let numberKey: number | undefined;

    switch (code) {
      // D-Pad
      case 38: // Up
        action = 'UP';
        break;
      case 40: // Down
        action = 'DOWN';
        break;
      case 37: // Left
        action = 'LEFT';
        break;
      case 39: // Right
        action = 'RIGHT';
        break;

      // OK / Enter
      case 13:
        action = 'ENTER';
        break;

      // WebOS Return / Back / Esc
      case 461: // webOS Back
      case 10009: // Tizen / SmartTV Back
      case 27: // Escape
      case 8: // Backspace
        action = 'BACK';
        break;

      // Color Keys
      case 403: // Red
      case 112: // F1
        action = 'RED';
        break;
      case 404: // Green
      case 113: // F2
        action = 'GREEN';
        break;
      case 405: // Yellow
      case 114: // F3
        action = 'YELLOW';
        break;
      case 406: // Blue
      case 115: // F4
        action = 'BLUE';
        break;

      // Channel Step
      case 33: // PageUp
      case 427: // webOS ChUp
        action = 'CH_UP';
        break;
      case 34: // PageDown
      case 428: // webOS ChDown
        action = 'CH_DOWN';
        break;

      // Media Keys
      case 415: // Play
        action = 'PLAY';
        break;
      case 19: // Pause
        action = 'PAUSE';
        break;
      case 179: // Play/Pause
      case 32: // Space
        action = 'PLAY_PAUSE';
        break;
      case 413: // Stop
        action = 'STOP';
        break;
      case 417: // FF
        action = 'FAST_FORWARD';
        break;
      case 412: // RW
        action = 'REWIND';
        break;

      // Guide / Info
      case 458: // Guide
        action = 'GUIDE';
        break;
      case 457: // Info
        action = 'INFO';
        break;

      default:
        // Number keys 0-9
        if (code >= 48 && code <= 57) {
          action = 'NUMBER';
          numberKey = code - 48;
        } else if (code >= 96 && code <= 105) {
          action = 'NUMBER';
          numberKey = code - 96;
        }
        break;
    }

    if (action) {
      // Prevent default page scroll on arrow keys
      if (['UP', 'DOWN', 'LEFT', 'RIGHT', 'BACK', 'CH_UP', 'CH_DOWN', 'PLAY_PAUSE'].includes(action)) {
        e.preventDefault();
      }
      this.listeners.forEach(cb => cb({ action: action!, numberKey, originalEvent: e }));
    }
  }
}

export const globalRemote = new RemoteController();
