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
      decay: 2.2,
      wet: 0.45,
    },
    delay: {
      enabled: false,
      delaySeconds: 0.22,
      feedback: 0.35,
      wet: 0.4,
      advancedClamp: true,
    },
    autotune: {
      enabled: false,
      semitones: 0,
    },
  },

  meterData: null,
  audio: {
    context: null,
    micSource: null,
    levelAnalyser: null,
    inputGain: null,
    playbackGain: null,
    dryBus: null,
    master: null,
    safetyCompressor: null,
    reverbSend: null,
    reverbNode: null,
    reverbWet: null,
    delaySend: null,
    delayInput: null,
    delayNode: null,
    delayFeedback: null,
    delayFeedbackFilter: null,
    delayWet: null,
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
