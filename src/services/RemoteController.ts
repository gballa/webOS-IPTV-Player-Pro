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
  stopDefaultNavigation?: () => void;
  readonly defaultPrevented?: boolean;
}

export class RemoteController {
  private listeners: ((event: RemoteEvent) => void)[] = [];
  private currentFocused: HTMLElement | null = null;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocusIn = this.handleFocusIn.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown, true);
      window.addEventListener('focusin', this.handleFocusIn, true);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown, true);
      window.removeEventListener('focusin', this.handleFocusIn, true);
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
   * Track which element received focus and update visual highlight
   */
  private handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement | null;
    if (target && target !== document.body) {
      this.currentFocused = target;
      this.applyVisualFocus(target);
    }
  }

  /**
   * Applies high-contrast TV focus highlight to the element
   */
  applyVisualFocus(target: HTMLElement) {
    const prev = document.querySelectorAll('.is-focused');
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== target) {
        prev[i].classList.remove('is-focused');
      }
    }
    target.classList.add('is-focused');
  }

  /**
   * Directly dispatch simulated remote button clicks (from on-screen remote or touch)
   */
  emitSimulated(action: RemoteAction, numberKey?: number) {
    const fakeEvent = new KeyboardEvent('keydown', { key: action });
    let defaultPrevented = false;
    const remoteEvent: RemoteEvent = {
      action,
      numberKey,
      originalEvent: fakeEvent,
      stopDefaultNavigation: () => {
        defaultPrevented = true;
      },
      get defaultPrevented() {
        return defaultPrevented;
      },
    };

    this.listeners.forEach(cb => cb(remoteEvent));

    if (!defaultPrevented) {
      if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
        this.navigate(action);
      } else if (action === 'ENTER') {
        this.triggerEnter();
      }
    }
  }

  /**
   * 2D Spatial Directional Navigation across all focusable elements in the active view
   */
  navigate(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') {
    let current = (document.activeElement as HTMLElement) || this.currentFocused;
    if (!current || current === document.body || !document.body.contains(current)) {
      this.focusInitialElement();
      return;
    }

    // If modal is open, scope focus within that modal
    const modal = document.querySelector<HTMLElement>(
      '[role="dialog"], .tv-modal-container, div[class*="fixed inset-0"][class*="z-50"]'
    );
    const container = modal || document.body;

    const selector =
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), .tv-focusable, .tv-card-focus';
    const all = Array.from(container.querySelectorAll<HTMLElement>(selector));

    const candidates = all.filter((el) => {
      if (el === current) return false;
      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      return true;
    });

    if (candidates.length === 0) return;

    const curRect = current.getBoundingClientRect();
    const curCx = curRect.left + curRect.width / 2;
    const curCy = curRect.top + curRect.height / 2;

    let bestCandidate: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const cand of candidates) {
      const rect = cand.getBoundingClientRect();
      const candCx = rect.left + rect.width / 2;
      const candCy = rect.top + rect.height / 2;

      let dPrimary = 0;
      let dSecondary = 0;
      let isDirectional = false;

      switch (direction) {
        case 'UP':
          if (rect.bottom <= curRect.top + 10 || candCy < curCy - 4) {
            isDirectional = true;
            dPrimary = Math.max(0, curRect.top - rect.bottom);
            const overlapX = Math.max(0, Math.min(curRect.right, rect.right) - Math.max(curRect.left, rect.left));
            dSecondary = overlapX > 0 ? 0 : Math.min(Math.abs(curRect.left - rect.right), Math.abs(rect.left - curRect.right));
          }
          break;
        case 'DOWN':
          if (rect.top >= curRect.bottom - 10 || candCy > curCy + 4) {
            isDirectional = true;
            dPrimary = Math.max(0, rect.top - curRect.bottom);
            const overlapX = Math.max(0, Math.min(curRect.right, rect.right) - Math.max(curRect.left, rect.left));
            dSecondary = overlapX > 0 ? 0 : Math.min(Math.abs(curRect.left - rect.right), Math.abs(rect.left - curRect.right));
          }
          break;
        case 'LEFT':
          if (rect.right <= curRect.left + 10 || candCx < curCx - 4) {
            isDirectional = true;
            dPrimary = Math.max(0, curRect.left - rect.right);
            const overlapY = Math.max(0, Math.min(curRect.bottom, rect.bottom) - Math.max(curRect.top, rect.top));
            dSecondary = overlapY > 0 ? 0 : Math.min(Math.abs(curRect.top - rect.bottom), Math.abs(rect.top - curRect.bottom));
          }
          break;
        case 'RIGHT':
          if (rect.left >= curRect.right - 10 || candCx > curCx + 4) {
            isDirectional = true;
            dPrimary = Math.max(0, rect.left - curRect.right);
            const overlapY = Math.max(0, Math.min(curRect.bottom, rect.bottom) - Math.max(curRect.top, rect.top));
            dSecondary = overlapY > 0 ? 0 : Math.min(Math.abs(curRect.top - rect.bottom), Math.abs(rect.top - curRect.bottom));
          }
          break;
      }

      if (isDirectional) {
        const score = dPrimary + dSecondary * 2.5;
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = cand;
        }
      }
    }

    // Fallback: If no strict directional overlap, pick candidate closest along directional half-plane
    if (!bestCandidate) {
      for (const cand of candidates) {
        const rect = cand.getBoundingClientRect();
        const candCx = rect.left + rect.width / 2;
        const candCy = rect.top + rect.height / 2;
        const dx = candCx - curCx;
        const dy = candCy - curCy;

        let inSector = false;
        if (direction === 'UP' && dy < -5) inSector = true;
        if (direction === 'DOWN' && dy > 5) inSector = true;
        if (direction === 'LEFT' && dx < -5) inSector = true;
        if (direction === 'RIGHT' && dx > 5) inSector = true;

        if (inSector) {
          const dist = Math.hypot(dx, dy);
          if (dist < bestScore) {
            bestScore = dist;
            bestCandidate = cand;
          }
        }
      }
    }

    if (bestCandidate) {
      if (!bestCandidate.hasAttribute('tabindex') && bestCandidate.tagName !== 'BUTTON' && bestCandidate.tagName !== 'INPUT' && bestCandidate.tagName !== 'A') {
        bestCandidate.setAttribute('tabindex', '0');
      }
      this.currentFocused = bestCandidate;
      bestCandidate.focus();
      this.applyVisualFocus(bestCandidate);
      try {
        bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } catch (_) {
        bestCandidate.scrollIntoView(false);
      }
    }
  }

  /**
   * Triggers click/activation on currently focused element or sets initial focus
   */
  triggerEnter(): void {
    const active = (document.activeElement as HTMLElement) || this.currentFocused;
    if (active && active !== document.body) {
      active.click();
    } else {
      this.focusInitialElement();
    }
  }

  /**
   * Automatically sets focus on the initial active item (active tab or first interactive element)
   */
  focusInitialElement(): HTMLElement | null {
    const modal = document.querySelector<HTMLElement>(
      '[role="dialog"], .tv-modal-container, div[class*="fixed inset-0"][class*="z-50"]'
    );
    const container = modal || document.body;

    const selector =
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href], input:not([disabled]), .tv-focusable, .tv-card-focus';
    const all = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
      if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });

    if (all.length === 0) return null;

    // Prefer active tab in navbar, or first prominent element
    const preferred =
      all.find((el) => el.classList.contains('bg-[var(--tv-accent)]')) ||
      all.find((el) => el.closest('nav') !== null) ||
      all[0];

    if (preferred) {
      if (!preferred.hasAttribute('tabindex') && preferred.tagName !== 'BUTTON' && preferred.tagName !== 'A') {
        preferred.setAttribute('tabindex', '0');
      }
      this.currentFocused = preferred;
      preferred.focus();
      this.applyVisualFocus(preferred);
      return preferred;
    }
    return null;
  }

  private handleKeyDown(e: KeyboardEvent) {
    const code = e.keyCode || e.which;

    // Don't intercept if user is actively typing in an input or textarea
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      if (code === 27 || code === 461) {
        // Allow BACK to blur input
        (active as HTMLElement).blur();
        e.preventDefault();
        return;
      }
      // Allow ENTER to trigger search / submit
      if (code === 13) {
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
      // Prevent default browser scroll on arrow keys
      if (['UP', 'DOWN', 'LEFT', 'RIGHT', 'BACK', 'CH_UP', 'CH_DOWN', 'PLAY_PAUSE'].includes(action)) {
        e.preventDefault();
      }

      let defaultPrevented = false;
      const remoteEvent: RemoteEvent = {
        action: action!,
        numberKey,
        originalEvent: e,
        stopDefaultNavigation: () => {
          defaultPrevented = true;
        },
        get defaultPrevented() {
          return defaultPrevented;
        },
      };

      this.listeners.forEach(cb => cb(remoteEvent));

      if (!defaultPrevented) {
        if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
          this.navigate(action);
        } else if (action === 'ENTER') {
          this.triggerEnter();
        }
      }
    }
  }
}

export const globalRemote = new RemoteController();
