import { getMostRecentReadyClip, getTransportClip, state } from './state.js';
import { clamp, formatSeconds } from './utils.js';
import { dom, setStatusMessage } from './dom.js';
import { renderTimeline } from './timeline.js';
import { logAction } from './logging.js';
import * as audio from './audio.js';
import { ACTION_TYPES, dispatchAction } from './actions.js';
import { connectRemote } from './remote.js';

function onClipSelect(clip) {
  setStatusMessage(`Selected ${clip.label}`);
  logAction(state, {
    source: 'ui',
    type: 'SELECT_CLIP',
    id: clip.id,
  });
  render();
}

function onTrackSelect(track) {
  state.activeTrackId = track.id;
  logAction(state, {
    source: 'ui',
    type: 'SELECT_TRACK',
    id: track.id,
  });
  render();
}

function startUiTicker() {
  if (state.uiFrame.running) {
    return;
  }

  state.uiFrame.running = true;

  const tick = () => {
    if (!state.uiFrame.running) {
      return;
    }

    if (state.recordingActive || state.isPlaybackPlaying) {
      if (state.isPlaybackPlaying) {
        audio.updatePlayheadPosition(state);
      }
      renderTimeline(state, dom, onClipSelect, onTrackSelect);
      state.uiFrame.id = requestAnimationFrame(tick);
      return;
    }

    state.uiFrame.running = false;
    state.uiFrame.id = null;
    render();
  };

  state.uiFrame.id = requestAnimationFrame(tick);
}

function render() {
  if (state.pendingStatusMessage) {
    setStatusMessage(state.pendingStatusMessage);
    state.pendingStatusMessage = null;
  }

  const activeClip = getTransportClip(state);

  dom.recordingState.textContent = state.recordingActive ? 'Yes' : 'No';
  dom.loopState.textContent = state.isLooping ? 'Yes' : 'No';
  dom.playbackState.textContent = state.isPlaybackPlaying
    ? 'Playing'
    : state.isPlaybackPaused
      ? 'Paused'
      : 'Stopped';

  const loopLengthSeconds = state.isLooping
    ? state.loopRegionLengthSec
    : state.playback.mode === 'session' && (state.isPlaybackPlaying || state.isPlaybackPaused)
      ? state.playback.duration
    : activeClip
      ? activeClip.duration
      : 0;

  dom.loopLength.textContent = `${formatSeconds(loopLengthSeconds || 0)} s`;
  dom.timelineScaleValue.textContent = String(state.timeline.pixelsPerSecond);
  dom.reverbDecayValue.textContent = formatSeconds(state.effects.reverb.decay);
  dom.delayTimeValue.textContent = formatSeconds(state.effects.delay.delaySeconds);
  dom.delayFeedbackValue.textContent = Math.round(state.effects.delay.feedback * 100);
  dom.delayWetValue.textContent = Math.round(state.effects.delay.wet * 100);
  dom.autotuneValue.textContent = state.effects.autotune.semitones;

  dom.enableMicBtn.disabled = state.micEnabled;
  dom.startRecordBtn.disabled = !state.micEnabled || state.recordingActive;
  dom.endRecordBtn.disabled = !state.recordingActive;

  const transportReady = !!getMostRecentReadyClip(state);
  dom.playbackBtn.disabled = (!transportReady && !state.isPlaybackPaused) || state.recordingActive;
  dom.startLoopBtn.disabled = !transportReady;
  dom.endLoopBtn.disabled = !transportReady || (state.loopSelectionStartSec == null && !state.isLooping);

  dom.monitorToggle.checked = false;
  dom.monitorToggle.disabled = true;
  dom.monitorToggle.title = 'Monitoring disabled in this demo';

  dom.reverbEnabled.checked = state.effects.reverb.enabled;
  dom.delayEnabled.checked = state.effects.delay.enabled;
  dom.autotuneEnabled.checked = state.effects.autotune.enabled;
  dom.delayAdvanced.checked = state.effects.delay.advancedClamp;
  dom.reverbDecay.value = String(state.effects.reverb.decay);
  dom.delayTime.value = String(state.effects.delay.delaySeconds);
  dom.delayFeedback.value = String(Math.round(state.effects.delay.feedback * 100));
  dom.delayWet.value = String(Math.round(state.effects.delay.wet * 100));

  const playbackLabel = state.isPlaybackPlaying
    ? 'Pause'
    : state.isPlaybackPaused
      ? 'Resume'
      : 'Playback';
  dom.playbackBtn.textContent = playbackLabel;
  dom.startLoopBtn.textContent = 'Start Loop';
  dom.endLoopBtn.textContent = state.loopSelectionStartSec != null
    ? 'Set Loop End'
    : state.isLooping
      ? 'Stop Loop'
      : 'End Loop';

  renderTimeline(state, dom, onClipSelect, onTrackSelect);
}

function runAction(action) {
  const envelope = {
    source: 'ui',
    ...action,
  };

  Promise.resolve()
    .then(() => dispatchAction(state, envelope))
    .then((result) => {
      if (state.recordingActive || state.isPlaybackPlaying) {
        startUiTicker();
      }
      if (result?.label) {
        setStatusMessage(result.label);
      }
      render();
    })
    .catch((error) => {
      console.error('[action]', envelope.type, error);
      setStatusMessage(error?.message || 'Action failed.', true);
      logAction(state, {
        source: envelope.source,
        type: envelope.type,
        id: envelope.id,
        error: error?.message || 'Action failed.',
        status: 'error',
      });
      render();
    });
}

function wireEffects() {
  dom.reverbEnabled.addEventListener('change', () => {
    runAction({
      type: ACTION_TYPES.SET_REVERB_ENABLED,
      payload: { enabled: dom.reverbEnabled.checked },
    });
  });

  dom.reverbDecay.addEventListener('input', () => {
    runAction({
      type: ACTION_TYPES.SET_REVERB_DECAY,
      payload: { value: Number(dom.reverbDecay.value) },
    });
  });

  dom.delayEnabled.addEventListener('change', () => {
    runAction({
      type: ACTION_TYPES.SET_DELAY_ENABLED,
      payload: { enabled: dom.delayEnabled.checked },
    });
  });

  dom.delayTime.addEventListener('input', () => {
    runAction({
      type: ACTION_TYPES.SET_DELAY_TIME,
      payload: { value: Number(dom.delayTime.value) },
    });
  });

  dom.delayFeedback.addEventListener('input', () => {
    runAction({
      type: ACTION_TYPES.SET_DELAY_FEEDBACK,
      payload: { value: Number(dom.delayFeedback.value) },
    });
  });

  dom.delayWet.addEventListener('input', () => {
    runAction({
      type: ACTION_TYPES.SET_DELAY_WET,
      payload: { value: Number(dom.delayWet.value) },
    });
  });

  dom.delayAdvanced.addEventListener('change', () => {
    runAction({
      type: ACTION_TYPES.SET_DELAY_ADVANCED_CLAMP,
      payload: { enabled: dom.delayAdvanced.checked },
    });
  });

  dom.autotuneEnabled.addEventListener('change', () => {
    runAction({
      type: ACTION_TYPES.SET_AUTOTUNE_ENABLED,
      payload: { enabled: dom.autotuneEnabled.checked },
    });
  });

  dom.autotuneSemitones.addEventListener('input', () => {
    runAction({
      type: ACTION_TYPES.SET_AUTOTUNE_SEMITONES,
      payload: { value: Number(dom.autotuneSemitones.value) },
    });
  });
}

function wireControls() {
  dom.enableMicBtn.addEventListener('click', () => {
    runAction({
      type: ACTION_TYPES.ENABLE_MIC,
      payload: {
        onLevelChange: (level) => {
          dom.levelFill.style.width = `${level}%`;
        },
      },
    });
  });

  dom.monitorToggle.addEventListener('change', () => {
    runAction({
      type: ACTION_TYPES.TOGGLE_MONITORING,
      payload: { enabled: dom.monitorToggle.checked },
    });
  });

  dom.startRecordBtn.addEventListener('click', () => {
    runAction({
      type: ACTION_TYPES.START_RECORD,
    });
  });

  dom.endRecordBtn.addEventListener('click', () => {
    runAction({
      type: ACTION_TYPES.END_RECORD,
    });
  });

  dom.playbackBtn.addEventListener('click', () => {
    runAction({
      type: ACTION_TYPES.PLAY,
    });
  });

  dom.startLoopBtn.addEventListener('click', () => {
    runAction({
      type: ACTION_TYPES.START_LOOP,
    });
  });

  dom.endLoopBtn.addEventListener('click', () => {
    runAction({
      type: ACTION_TYPES.END_LOOP,
    });
  });

  dom.timelineScale.addEventListener('input', () => {
    state.timeline.pixelsPerSecond = Number(dom.timelineScale.value);
    render();
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection caught', event.reason);
  });
}

function initialize() {
  wireEffects();
  wireControls();
  state.onTransportEnded = () => {
    render();
  };

  connectRemote(state);
  audio.updateEffectsNodes(state);
  audio.setMonitoringEnabled(state, state.monitoringEnabled);

  render();
  setStatusMessage('Click Enable Mic first, then record and play.');
}

initialize();

export {};
