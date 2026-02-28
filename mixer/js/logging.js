import { formatSeconds } from './utils.js';
import { getTransportClip } from './state.js';

export function snapshot(appState) {
  const clip = getTransportClip(appState);
  const loopLength = appState.isLooping ? appState.loopRegionLengthSec : clip ? clip.duration : 0;

  return {
    micEnabled: appState.micEnabled,
    monitoringEnabled: appState.monitoringEnabled,
    recordingActive: appState.recordingActive,
    loopActive: appState.isLooping,
    playbackRunning: appState.isPlaybackPlaying,
    playbackPaused: appState.isPlaybackPaused,
    loopLengthSeconds: formatSeconds(loopLength || 0),
    loopRegionStartSeconds: formatSeconds(appState.loopRegionStartSec || 0),
    loopRegionLengthSeconds: formatSeconds(appState.loopRegionLengthSec || 0),
    effectsEnabled: {
      reverb: appState.effects.reverb.enabled,
      delay: appState.effects.delay.enabled,
      autotune: appState.effects.autotune.enabled,
    },
    clips: appState.clips.length,
    selectedClipId: appState.selectedClipId,
    activeTrackId: appState.activeTrackId,
  };
}

export function logAction(appState, action) {
  const record =
    typeof action === 'string'
      ? {
          source: 'ui',
          type: action,
        }
      : action || {};

  const snap = snapshot(appState);
  const source = record?.source || 'ui';
  const type = record?.type || 'UNKNOWN';
  const status = record?.status || 'ok';
  const label = record?.label ? ` (${record.label})` : '';
  const error = record?.error ? ` ERR=${record.error}` : '';
  const id = record?.id ? `[id=${record.id}] ` : '';

  const message = `${source} ${type} ${id}-> rec=${snap.recordingActive}, loop=${snap.loopActive}, play=${snap.playbackRunning}, loopLen=${snap.loopLengthSeconds}s, effects=${JSON.stringify(
    snap.effectsEnabled,
  )}${label}${status !== 'ok' ? ` status=${status}` : ''}${error}`;

  console.log(`[${new Date().toISOString()}] ${message}`, snap);

  return message;
}
