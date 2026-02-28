import { clamp } from './utils.js';
import * as audio from './audio.js';
import { logAction } from './logging.js';

export const ACTION_TYPES = Object.freeze({
  ENABLE_MIC: 'ENABLE_MIC',
  START_RECORD: 'START_RECORD',
  END_RECORD: 'END_RECORD',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  START_LOOP: 'START_LOOP',
  END_LOOP: 'END_LOOP',
  SET_REVERB_ENABLED: 'SET_REVERB_ENABLED',
  SET_REVERB_DECAY: 'SET_REVERB_DECAY',
  SET_DELAY_ENABLED: 'SET_DELAY_ENABLED',
  SET_DELAY_TIME: 'SET_DELAY_TIME',
  SET_DELAY_FEEDBACK: 'SET_DELAY_FEEDBACK',
  SET_DELAY_WET: 'SET_DELAY_WET',
  SET_DELAY_ADVANCED_CLAMP: 'SET_DELAY_ADVANCED_CLAMP',
  SET_AUTOTUNE_ENABLED: 'SET_AUTOTUNE_ENABLED',
  SET_AUTOTUNE_SEMITONES: 'SET_AUTOTUNE_SEMITONES',
  TOGGLE_MONITORING: 'TOGGLE_MONITORING',
});

export const ACTION_TYPE_LIST = Object.values(ACTION_TYPES);
export const ACTION_ALLOWLIST = new Set(ACTION_TYPE_LIST);

function normalizeSource(source) {
  if (source === 'remote') {
    return 'remote';
  }
  return 'ui';
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const cleaned = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (typeof value === 'function') {
      return;
    }
    cleaned[key] = value;
  });
  return cleaned;
}

function numericPayloadValue(payload, keys, fallback = 0) {
  for (const key of keys) {
    if (payload[key] == null) {
      continue;
    }
    const parsed = Number(payload[key]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function isActionTypeAllowed(type) {
  return ACTION_ALLOWLIST.has(type);
}

export async function dispatchAction(appState, action = {}) {
  const {
    type,
    source: rawSource,
    payload = {},
    id,
    clientId,
  } = action;

  const source = normalizeSource(rawSource);
  const actionId = id || clientId || null;

  if (!isActionTypeAllowed(type)) {
    const error = new Error(`Unsupported action type: ${String(type)}`);
    logAction(appState, {
      source,
      type: type || 'UNKNOWN',
      id: actionId,
      payload: sanitizePayload(payload),
      status: 'error',
      error: error.message,
    });
    throw error;
  }

  try {
    let label = 'Action completed.';
    switch (type) {
      case ACTION_TYPES.ENABLE_MIC: {
        const onLevelChange =
          typeof payload?.onLevelChange === 'function'
            ? payload.onLevelChange
            : typeof payload?.onMeterChange === 'function'
              ? payload.onMeterChange
              : () => {};

        if (appState.audioReady) {
          label = 'Microphone already enabled.';
          break;
        }

        await audio.ensureContext(appState);
        await audio.enableMic(appState, onLevelChange);
        label = 'Microphone enabled.';
        break;
      }
      case ACTION_TYPES.START_RECORD:
        if (!appState.micEnabled) {
          throw new Error('Enable the microphone before recording.');
        }
        if (appState.recordingActive) {
          throw new Error('Already recording.');
        }
        if (!audio.startRecording(appState)) {
          throw new Error('Unable to start recording.');
        }
        label = `Recording ${appState.selectedClipId ? `clip ${appState.selectedClipId}` : ''}`.trim();
        break;

      case ACTION_TYPES.END_RECORD:
        if (!appState.recordingActive) {
          throw new Error('No active recording.');
        }
        if (!audio.endRecording(appState)) {
          throw new Error('Unable to end recording.');
        }
        label = 'Stopped recording.';
        break;

      case ACTION_TYPES.PLAY: {
        if (appState.isPlaybackPlaying) {
          if (!audio.pausePlayback(appState)) {
            throw new Error('Unable to pause playback.');
          }
          label = 'Playback paused.';
          break;
        }

        if (appState.isPlaybackPaused) {
          const resumed = audio.resumePlayback(appState);
          if (resumed === false) {
            throw new Error('Unable to resume playback.');
          }
          label = `Resumed ${resumed.label || 'playback'}`;
          break;
        }

        const clip = audio.startPlayback(appState);
        label = `Playing ${clip.label}`;
        break;
      }

      case ACTION_TYPES.PAUSE:
        if (!appState.isPlaybackPlaying || !appState.playback.source) {
          throw new Error('Nothing is currently playing.');
        }
        if (!audio.pausePlayback(appState)) {
          throw new Error('Unable to pause playback.');
        }
        label = 'Playback paused.';
        break;

      case ACTION_TYPES.START_LOOP: {
        if (appState.recordingActive) {
          throw new Error('Cannot start loop while recording.');
        }
        const marker = audio.startLoop(appState);
        label = `Loop start set at ${marker.startSec.toFixed(2)}s`;
        break;
      }

      case ACTION_TYPES.END_LOOP: {
        const result = audio.endLoop(appState);
        if (!result) {
          throw new Error('Set loop start first.');
        }
        if (result.mode === 'stop') {
          label = 'Loop ended.';
          break;
        }
        label = `Looping ${result.startSec.toFixed(2)}s to ${result.endSec.toFixed(2)}s`;
        break;
      }

      case ACTION_TYPES.SET_REVERB_ENABLED: {
        appState.effects.reverb.enabled = !!payload.enabled;
        audio.updateEffectsNodes(appState);
        label = `Reverb ${appState.effects.reverb.enabled ? 'enabled' : 'disabled'}`;
        break;
      }

      case ACTION_TYPES.SET_REVERB_DECAY: {
        const decay = numericPayloadValue(payload, ['value', 'decay']);
        appState.effects.reverb.decay = clamp(decay, 0.2, 8);
        audio.updateEffectsNodes(appState);
        label = `Reverb decay set to ${appState.effects.reverb.decay}`;
        break;
      }

      case ACTION_TYPES.SET_DELAY_ENABLED: {
        appState.effects.delay.enabled = !!payload.enabled;
        audio.updateEffectsNodes(appState);
        label = `Delay ${appState.effects.delay.enabled ? 'enabled' : 'disabled'}`;
        break;
      }

      case ACTION_TYPES.SET_DELAY_TIME: {
        const delaySeconds = numericPayloadValue(payload, ['value', 'seconds', 'delaySeconds']);
        appState.effects.delay.delaySeconds = clamp(delaySeconds, 0.05, 1.2);
        audio.updateEffectsNodes(appState);
        label = `Delay time set to ${appState.effects.delay.delaySeconds}`;
        break;
      }

      case ACTION_TYPES.SET_DELAY_FEEDBACK: {
        const maxFeedback = audio.getDelayFeedbackMax(appState.effects.delay);
        const feedback = numericPayloadValue(payload, ['value', 'feedback', 'percent']) / 100;
        appState.effects.delay.feedback = clamp(feedback, 0, maxFeedback);
        audio.updateEffectsNodes(appState);
        label = `Delay feedback set to ${(appState.effects.delay.feedback * 100).toFixed(0)}%`;
        break;
      }

      case ACTION_TYPES.SET_DELAY_WET: {
        const wet = numericPayloadValue(payload, ['value', 'wet', 'percent']) / 100;
        appState.effects.delay.wet = clamp(wet, 0, 1);
        audio.updateEffectsNodes(appState);
        label = `Delay wet set to ${(appState.effects.delay.wet * 100).toFixed(0)}%`;
        break;
      }

      case ACTION_TYPES.SET_DELAY_ADVANCED_CLAMP: {
        appState.effects.delay.advancedClamp = !!payload.enabled;
        audio.updateEffectsNodes(appState);
        label = `Delay advanced clamp ${appState.effects.delay.advancedClamp ? 'enabled' : 'disabled'}`;
        break;
      }

      case ACTION_TYPES.SET_AUTOTUNE_ENABLED: {
        appState.effects.autotune.enabled = !!payload.enabled;
        audio.updateEffectsNodes(appState);
        label = `Autotune ${appState.effects.autotune.enabled ? 'enabled' : 'disabled'}`;
        break;
      }

      case ACTION_TYPES.SET_AUTOTUNE_SEMITONES: {
        const semitones = numericPayloadValue(payload, ['value', 'semitones']);
        appState.effects.autotune.semitones = clamp(Math.round(semitones), -12, 12);
        audio.updateEffectsNodes(appState);
        label = `Autotune semitones set to ${appState.effects.autotune.semitones}`;
        break;
      }

      case ACTION_TYPES.TOGGLE_MONITORING: {
        const enabled = !!payload.enabled;
        appState.monitoringEnabled = enabled;
        audio.setMonitoringEnabled(appState, enabled);
        label = 'Monitoring settings updated.';
        break;
      }

      default:
        throw new Error(`Unhandled action type: ${type}`);
    }

    logAction(appState, {
      source,
      type,
      id: actionId,
      payload: sanitizePayload(payload),
      status: 'ok',
      label,
    });

    return {
      ok: true,
      id: actionId,
      type,
      label,
    };
  } catch (error) {
    logAction(appState, {
      source,
      type,
      id: actionId,
      payload: sanitizePayload(payload),
      status: 'error',
      error: error.message,
    });
    throw error;
  }
}
