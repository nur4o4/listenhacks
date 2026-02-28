export const state = {
  audioReady: false,
  micEnabled: false,
  monitoringEnabled: false,
  sessionStartSec: null,
  recordingActive: false,
  recordingClipId: null,
  recordingStart: 0,
  recordingAutoStopTimer: null,
  recordingChunks: [],
  mediaRecorder: null,
  mediaStream: null,
  handTrackingEnabled: false,
  handTrackingStream: null,
  handGestureLabel: 'none',
  pendingStatusMessage: null,

  isPlaybackPlaying: false,
  isLooping: false,
  isPlaybackPaused: false,
  playbackPausedOffset: 0,
  activeTransportId: null,
  loopRegionStartSec: null,
  loopRegionLengthSec: 0,
  loopSelectionStartSec: null,
  loopMixBuffer: null,
  playback: {
    source: null,
    clipId: null,
    duration: 0,
    startOffset: 0,
    startedAt: 0,
    playbackRate: 1,
    loop: false,
    manualStopReason: 'none',
    transportId: null,
    baseStartSec: 0,
    mode: 'clip',
  },
  playbackPlayheadSec: 0,

  uiFrame: {
    running: false,
    id: null,
  },

  tracks: [
    { id: 'track-1', name: 'Track 1' },
  ],
  activeTrackId: 'track-1',

  clips: [],
  selectedClipId: null,
  nextClipIndex: 1,

  timeline: {
    pixelsPerSecond: 80,
  },

  effects: {
    reverb: {
      enabled: false,
      params: {
        echo: {
          delayMs: 320,
          feedback: 0.62,
          wet: 0.65,
          dry: 0.82,
        },
        reverb: {
          roomSize: 0.74,
          damp: 0.35,
          wet: 0.3,
          earlyMix: 0.22,
        },
      },
    },
    distortion: {
      enabled: false,
    },
  },

  meterData: null,
  audio: {
    context: null,
    micSource: null,
    levelAnalyser: null,
    inputGain: null,
    playbackGain: null,
    master: null,
    safetyCompressor: null,
    echoReverbNode: null,
    echoReverbState: null,
    distortionSend: null,
    distortionNode: null,
    distortionWet: null,
    meterFrame: null,
  },

  onTransportEnded: null,
};

export function getClipById(appState, id) {
  return appState.clips.find((clip) => clip.id === id) || null;
}

export function getSelectedClip(appState) {
  return getClipById(appState, appState.selectedClipId);
}

export function getMostRecentReadyClip(appState) {
  return [...appState.clips].reverse().find((clip) => clip.status === 'ready') || null;
}

export function getTransportClip(appState) {
  const selected = getSelectedClip(appState);
  if (selected && selected.status === 'ready') {
    return selected;
  }
  return getMostRecentReadyClip(appState);
}
