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
  SET_DISTORTION_ENABLED: 'SET_DISTORTION_ENABLED',
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

      case ACTION_TYPES.SET_DISTORTION_ENABLED: {
        appState.effects.distortion.enabled = !!payload.enabled;
        audio.updateEffectsNodes(appState);
        label = `Distortion ${appState.effects.distortion.enabled ? 'enabled' : 'disabled'}`;
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
