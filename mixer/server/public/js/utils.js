export const MIN_DELAY_FEEDBACK = 0;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function modulo(value, mod) {
  if (mod <= 0) return 0;
  return ((value % mod) + mod) % mod;
}

export function formatSeconds(value) {
  return Number(value || 0).toFixed(2);
}

export function nowMs() {
  return performance.now();
}

export function nowSessionSec(state) {
  if (state.sessionStartSec == null) {
    return 0;
  }
  return (nowMs() / 1000) - state.sessionStartSec;
}
