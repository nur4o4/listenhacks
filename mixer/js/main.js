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

  dom.enableMicBtn.disabled = state.micEnabled;
  dom.handTrackingState.textContent = state.handTrackingEnabled ? 'On' : 'Off';
  dom.handGestureState.textContent = state.handTrackingEnabled ? state.handGestureLabel : 'none';
  dom.toggleHandTrackingBtn.textContent = state.handTrackingEnabled ? 'Stop Hand Video' : 'Start Hand Video';
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
  dom.distortionEnabled.checked = state.effects.distortion.enabled;

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

  dom.distortionEnabled.addEventListener('change', () => {
    runAction({
      type: ACTION_TYPES.SET_DISTORTION_ENABLED,
      payload: { enabled: dom.distortionEnabled.checked },
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

  const HAND_COLORS = {
    Left: { line: '#42ff8f', point: '#7bffb3' },
    Right: { line: '#ff7a8f', point: '#ffb4c0' },
  };
  let handTracker = null;
  let handCamera = null;
  const mirroredInputCanvas = document.createElement('canvas');
  const mirroredInputCtx = mirroredInputCanvas.getContext('2d');
  const handGestureLatch = {
    Left: null,
    Right: null,
  };
  const handGestureStability = {
    Left: { token: null, frames: 0 },
    Right: { token: null, frames: 0 },
  };
  const GESTURE_STABLE_FRAMES = 4;

  const countFingers = (handLandmarks, handednessLabel) => {
    const tipsIds = [4, 8, 12, 16, 20];
    const fingers = [];

    if (handednessLabel === 'Right') {
      fingers.push(handLandmarks[4].x < handLandmarks[3].x ? 1 : 0);
    } else {
      fingers.push(handLandmarks[4].x > handLandmarks[3].x ? 1 : 0);
    }

    for (let i = 1; i < tipsIds.length; i += 1) {
      const tipId = tipsIds[i];
      fingers.push(handLandmarks[tipId].y < handLandmarks[tipId - 2].y ? 1 : 0);
    }

    return fingers.reduce((sum, finger) => sum + finger, 0);
  };

  const gestureTokenFromCount = (count) => {
    if (count === 0) {
      return 'fist';
    }
    if (count === 5) {
      return 'open';
    }
    return String(count);
  };

  const commandForGesture = (handLabel, gestureToken) => {
    if (handLabel === 'Right') {
      if (gestureToken === 'open') {
        return 'START_RECORD';
      }
      if (gestureToken === 'fist') {
        return 'END_RECORD';
      }
      if (gestureToken === '2') {
        return 'TOGGLE_REVERB';
      }
      if (gestureToken === '3') {
        return 'TOGGLE_DISTORTION';
      }
      return null;
    }

    // Left hand gestures
    if (gestureToken === '1') {
      return 'PLAY_FROM_START';
    }
    if (gestureToken === 'fist') {
      return 'PAUSE';
    }
    if (gestureToken === 'open') {
      return 'START_CHATBOT_RECORDING'; // 5 fingers - start recording
    }
    if (gestureToken === '2') {
      return 'START_LOOP';
    }
    if (gestureToken === '3') {
      return 'END_LOOP';
    }
    if (gestureToken === '4') {
      return 'STOP_CHATBOT_RECORDING'; // 4 fingers - stop recording
    }
    return null;
  };

  const runPlaybackFromStart = () => {
    if (!getMostRecentReadyClip(state)) {
      return;
    }
    if (state.playback.source) {
      audio.stopTransport(state, 'replace');
    }

    state.isPlaybackPaused = false;
    state.playbackPausedOffset = 0;
    state.isLooping = false;
    state.loopSelectionStartSec = null;
    state.loopRegionStartSec = null;
    state.loopRegionLengthSec = 0;
    state.loopMixBuffer = null;

    try {
      const result = audio.startPlayback(state);
      setStatusMessage(`Playing ${result.label} from start`);
      startUiTicker();
      render();
    } catch (error) {
      setStatusMessage(error?.message || 'Unable to start playback from beginning.', true);
      render();
    }
  };

  const executeGestureCommand = (command) => {
    switch (command) {
      case 'START_RECORD':
        if (!state.recordingActive) {
          // Auto-enable mic if not already enabled
          if (!state.micEnabled) {
            runAction({
              type: ACTION_TYPES.ENABLE_MIC,
              payload: {
                onLevelChange: (level) => {
                  dom.levelFill.style.width = `${level}%`;
                },
              },
            });
            // Wait a moment for mic to initialize, then start recording
            setTimeout(() => {
              if (state.micEnabled) {
                runAction({ type: ACTION_TYPES.START_RECORD });
              }
            }, 500);
          } else {
            runAction({ type: ACTION_TYPES.START_RECORD });
          }
        }
        break;
      case 'END_RECORD':
        if (state.recordingActive) {
          runAction({ type: ACTION_TYPES.END_RECORD });
        }
        break;
      case 'PLAY_FROM_START':
        runPlaybackFromStart();
        break;
      case 'PAUSE':
        if (state.isPlaybackPlaying) {
          runAction({ type: ACTION_TYPES.PAUSE });
        }
        break;
      case 'CONTINUE':
        if (state.isPlaybackPaused) {
          runAction({ type: ACTION_TYPES.PLAY });
        }
        break;
      case 'START_LOOP':
        runAction({ type: ACTION_TYPES.START_LOOP });
        break;
      case 'END_LOOP':
        if (state.loopSelectionStartSec != null || state.isLooping) {
          runAction({ type: ACTION_TYPES.END_LOOP });
        }
        break;
      case 'TOGGLE_DISTORTION':
        runAction({
          type: ACTION_TYPES.SET_DISTORTION_ENABLED,
          payload: { enabled: !state.effects.distortion.enabled },
        });
        break;
      case 'TOGGLE_REVERB':
        runAction({
          type: ACTION_TYPES.SET_REVERB_ENABLED,
          payload: { enabled: !state.effects.reverb.enabled },
        });
        break;
      case 'START_CHATBOT_RECORDING':
        if (window.chatbot && !window.chatbot.isListening) {
          window.chatbot.startListening();
        }
        break;
      case 'STOP_CHATBOT_RECORDING':
        if (window.chatbot && window.chatbot.isListening) {
          window.chatbot.stopListening();
        }
        break;
      default:
        break;
    }
  };

  const stopHandTrackingStream = () => {
    if (handCamera?.stop) {
      handCamera.stop();
    }
    handCamera = null;
    if (handTracker?.close) {
      handTracker.close();
    }
    handTracker = null;
    if (state.handTrackingStream) {
      state.handTrackingStream.getTracks().forEach((track) => track.stop());
    }
    state.handTrackingStream = null;
    state.handTrackingEnabled = false;
    state.handGestureLabel = 'none';
    handGestureLatch.Left = null;
    handGestureLatch.Right = null;
    handGestureStability.Left.token = null;
    handGestureStability.Left.frames = 0;
    handGestureStability.Right.token = null;
    handGestureStability.Right.frames = 0;
    dom.handTrackingVideo.srcObject = null;
    const ctx = dom.handTrackingCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.handTrackingCanvas.width, dom.handTrackingCanvas.height);
  };

  const startHandTrackingStream = async (showError = true) => {
    if (state.handTrackingEnabled) {
      return true;
    }

    if (typeof globalThis.Hands !== 'function' || typeof globalThis.Camera !== 'function') {
      if (showError) {
        setStatusMessage('Hand tracking libraries failed to load.', true);
      }
      return false;
    }

    try {
      handTracker = new globalThis.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      handTracker.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        selfieMode: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      handTracker.onResults((results) => {
        const canvas = dom.handTrackingCanvas;
        const ctx = canvas.getContext('2d');
        const frameWidth = results.image?.width || dom.handTrackingVideo.videoWidth || 640;
        const frameHeight = results.image?.height || dom.handTrackingVideo.videoHeight || 360;
        if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
          canvas.width = frameWidth;
          canvas.height = frameHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        // Recognition runs on mirrored frames; unmirror overlay drawing for UI alignment.
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        if (results.image) {
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        }

        const labels = [];
        if (results.multiHandLandmarks && results.multiHandedness) {
          for (let i = 0; i < results.multiHandLandmarks.length; i += 1) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];
            const rawHandLabel = handedness?.label || handedness?.classification?.[0]?.label || 'Right';
            const handLabel = rawHandLabel === 'Left' ? 'Right' : 'Left';
            const fingers = countFingers(landmarks, rawHandLabel);
            const gestureToken = gestureTokenFromCount(fingers);
            labels.push(`${handLabel}:${gestureToken}`);

            const colors = HAND_COLORS[handLabel] || HAND_COLORS.Right;
            if (globalThis.drawConnectors && globalThis.HAND_CONNECTIONS) {
              globalThis.drawConnectors(ctx, landmarks, globalThis.HAND_CONNECTIONS, {
                color: colors.line,
                lineWidth: 3,
              });
            }
            if (globalThis.drawLandmarks) {
              globalThis.drawLandmarks(ctx, landmarks, {
                color: colors.point,
                radius: 4,
              });
            }

            const stability = handGestureStability[handLabel];
            if (stability.token === gestureToken) {
              stability.frames += 1;
            } else {
              stability.token = gestureToken;
              stability.frames = 1;
            }

            if (
              stability.frames >= GESTURE_STABLE_FRAMES
              && handGestureLatch[handLabel] !== gestureToken
            ) {
              handGestureLatch[handLabel] = gestureToken;
              const command = commandForGesture(handLabel, gestureToken);
              if (command) {
                executeGestureCommand(command);
              }
            }
          }
        } else {
          handGestureLatch.Left = null;
          handGestureLatch.Right = null;
          handGestureStability.Left.token = null;
          handGestureStability.Left.frames = 0;
          handGestureStability.Right.token = null;
          handGestureStability.Right.frames = 0;
        }
        ctx.restore();

        state.handGestureLabel = labels.length ? labels.join(' | ') : 'none';
      });

      handCamera = new globalThis.Camera(dom.handTrackingVideo, {
        onFrame: async () => {
          if (!handTracker) {
            return;
          }
          const sourceWidth = dom.handTrackingVideo.videoWidth || 640;
          const sourceHeight = dom.handTrackingVideo.videoHeight || 360;
          if (mirroredInputCanvas.width !== sourceWidth || mirroredInputCanvas.height !== sourceHeight) {
            mirroredInputCanvas.width = sourceWidth;
            mirroredInputCanvas.height = sourceHeight;
          }
          mirroredInputCtx.save();
          mirroredInputCtx.translate(sourceWidth, 0);
          mirroredInputCtx.scale(-1, 1);
          mirroredInputCtx.drawImage(dom.handTrackingVideo, 0, 0, sourceWidth, sourceHeight);
          mirroredInputCtx.restore();
          await handTracker.send({ image: mirroredInputCanvas });
        },
      });

      await handCamera.start();
      state.handTrackingStream = dom.handTrackingVideo.srcObject;
      state.handTrackingEnabled = true;
      await dom.handTrackingVideo.play();
      setStatusMessage('Hand-tracking video started.');
      render();
      return true;
    } catch (error) {
      stopHandTrackingStream();
      state.handTrackingEnabled = false;
      state.handTrackingStream = null;
      if (showError) {
        setStatusMessage(error?.message || 'Could not access camera for hand-tracking video.', true);
      }
      render();
      return false;
    }
  };

  dom.toggleHandTrackingBtn.addEventListener('click', async () => {
    if (state.handTrackingEnabled) {
      stopHandTrackingStream();
      setStatusMessage('Hand-tracking video stopped.');
      render();
      return;
    }
    await startHandTrackingStream();
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

  dom.importBtn.addEventListener('click', () => {
    dom.importFileInput.click();
  });

  dom.importFileInput.addEventListener('change', () => {
    const file = dom.importFileInput.files[0];
    if (!file) {
      return;
    }
    setStatusMessage('Importing...');
    audio.importAudioFile(state, file)
      .then(() => {
        render();
      })
      .catch((error) => {
        console.error('[import]', error);
        setStatusMessage(error?.message || 'Import failed.', true);
        render();
      })
      .finally(() => {
        dom.importFileInput.value = '';
      });
  });

  dom.exportBtn.addEventListener('click', () => {
    try {
      const result = audio.exportSessionToMp3(state);
      setStatusMessage(`Exported MP3 (${result.duration.toFixed(2)}s).`);
    } catch (error) {
      console.error('[export]', error);
      setStatusMessage(error?.message || 'Export failed.', true);
    }
    render();
  });

  dom.timelineScale.addEventListener('input', () => {
    state.timeline.pixelsPerSecond = Number(dom.timelineScale.value);
    render();
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection caught', event.reason);
  });
  window.addEventListener('beforeunload', () => {
    stopHandTrackingStream();
  });

  return {
    startHandTrackingStream,
  };
}

function initialize() {
  wireEffects();
  const controls = wireControls();
  state.onTransportEnded = () => {
    render();
  };

  connectRemote(state);
  audio.updateEffectsNodes(state);
  audio.setMonitoringEnabled(state, state.monitoringEnabled);

  render();

  runAction({
    type: ACTION_TYPES.ENABLE_MIC,
    payload: {
      onLevelChange: (level) => {
        dom.levelFill.style.width = `${level}%`;
      },
    },
  });
  controls.startHandTrackingStream(false);
  setStatusMessage('Auto-enabling mic and hand video (permission may be required).');
}

initialize();

// Expose state and render to window for chatbot integration
window.state = state;
window.render = render;

export {};
