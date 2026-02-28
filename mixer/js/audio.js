import { clamp, modulo, nowMs, nowSessionSec } from './utils.js';
import { getClipById } from './state.js';
import {
  createEchoReverbState,
  processEchoReverbBlock,
  setEchoReverbParams,
} from './effects-engine.js';

function buildDistortionCurve(amount = 320) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = clamp(amount, 0, 1000);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

const EFFECT_RAMP_SECONDS = 0.06;
const STOP_FADE_SECONDS = 0.07;
const OVERLAP_EPSILON = 0.0005;
const LOOP_MIX_CHANNELS = 2;
const SOFT_CLIP_GAIN = 1.15;
const MIN_LOOP_REGION_SECONDS = 0.05;
const DISTORTION_DRIVE = 320;
const DISTORTION_WET_GAIN = 0.65;

function rampGainValue(gainNode, targetValue, context, seconds = EFFECT_RAMP_SECONDS) {
  if (!gainNode || !gainNode.gain) {
    return;
  }
  const now = context.currentTime;
  const clamped = clamp(targetValue, 0, 2);
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(clamped, now + seconds);
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function clipIntervalAtTime(appState, clip, nowSec) {
  const start = clip.startTimeSec ?? 0;
  if (clip.status === 'ready') {
    return {
      start,
      end: clip.endTimeSec ?? start,
    };
  }

  if (clip.status === 'recording' && appState.recordingActive) {
    return {
      start,
      end: nowSec,
    };
  }

  return {
    start,
    end: clip.endTimeSec ?? start,
  };
}

function lastReadyClipEndTimeSec(appState) {
  const readyClips = appState.clips.filter((clip) => clip.status === 'ready' && clip.endTimeSec != null);
  if (!readyClips.length) {
    return null;
  }

  return readyClips[readyClips.length - 1].endTimeSec;
}

function hasTimeOverlap(appState, trackId, probeStart, probeEnd, excludeClipId = null) {
  const nowSec = nowSessionSec(appState);
  return appState.clips.some((clip) => {
    if (clip.id === excludeClipId) {
      return false;
    }
    if (clip.trackId !== trackId || clip.startTimeSec == null) {
      return false;
    }
    const interval = clipIntervalAtTime(appState, clip, nowSec);
    return intervalsOverlap(probeStart, probeEnd, interval.start, interval.end);
  });
}

function getTrackForTimeRange(appState, probeStart, probeEnd, excludeClipId = null) {
  const probeStartSec = Number(probeStart);
  const probeEndSec = Number(probeEnd);
  for (let i = 0; i < appState.tracks.length; i += 1) {
    const candidate = appState.tracks[i];
    if (!hasTimeOverlap(appState, candidate.id, probeStartSec, probeEndSec, excludeClipId)) {
      return candidate.id;
    }
  }

  const newTrackId = `track-${appState.tracks.length + 1}`;
  appState.tracks.push({
    id: newTrackId,
    name: `Track ${appState.tracks.length + 1}`,
  });
  return newTrackId;
}

function createNewTrack(appState) {
  const newTrackId = `track-${appState.tracks.length + 1}`;
  appState.tracks.push({
    id: newTrackId,
    name: `Track ${appState.tracks.length + 1}`,
  });
  return newTrackId;
}

function assignClipToNonOverlappingTrack(appState, clip) {
  if (!clip || clip.status !== 'ready' || clip.startTimeSec == null || clip.endTimeSec == null) {
    return;
  }
  if (clip.lockTrack) {
    return;
  }

  const assignedTrackId = getTrackForTimeRange(appState, clip.startTimeSec, clip.endTimeSec, clip.id);
  if (assignedTrackId !== clip.trackId) {
    clip.trackId = assignedTrackId;
    appState.activeTrackId = assignedTrackId;
  }
}

function getTrackForRecordingStart(appState, startSec) {
  const startProbeEnd = startSec + OVERLAP_EPSILON;
  return getTrackForTimeRange(appState, startSec, startProbeEnd);
}

function loopRecordingStartSec(appState) {
  if (!appState.isLooping || !appState.isPlaybackPlaying || appState.loopRegionStartSec == null || appState.loopRegionLengthSec <= 0) {
    return null;
  }

  return appState.playback.baseStartSec + currentPlaybackOffset(appState);
}

function clearRecordingAutoStop(appState) {
  if (appState.recordingAutoStopTimer) {
    clearTimeout(appState.recordingAutoStopTimer);
    appState.recordingAutoStopTimer = null;
  }
}

function getRecordingStartSec(appState) {
  const loopStart = loopRecordingStartSec(appState);
  if (loopStart != null) {
    return loopStart;
  }

  const lastEnd = lastReadyClipEndTimeSec(appState);
  if (lastEnd == null) {
    return nowSessionSec(appState);
  }

  return lastEnd;
}

function softClipSample(value) {
  return Math.tanh(value * SOFT_CLIP_GAIN);
}

function readSampleAtFrame(channelData, frameIndex) {
  if (!channelData.length) {
    return 0;
  }

  const maxIndex = channelData.length - 1;
  const clampedIndex = clamp(frameIndex, 0, maxIndex);
  const lower = Math.floor(clampedIndex);
  const upper = Math.min(maxIndex, lower + 1);
  if (lower === upper) {
    return channelData[lower];
  }

  const mix = clampedIndex - lower;
  return channelData[lower] * (1 - mix) + channelData[upper] * mix;
}

function getReadyClipsWithTime(appState) {
  return appState.clips.filter((clip) => (
    clip.status === 'ready'
    && !!clip.buffer
    && Number.isFinite(clip.startTimeSec)
    && Number.isFinite(clip.endTimeSec)
    && clip.endTimeSec > clip.startTimeSec
  ));
}

function buildMixedBufferForWindow(appState, windowStartSec, windowLengthSec, providedClips = null) {
  if (!appState.audio.context || windowStartSec == null || windowLengthSec <= 0) {
    return null;
  }

  const ctx = appState.audio.context;
  const mixStart = windowStartSec;
  const mixLength = windowLengthSec;
  const mixEnd = mixStart + mixLength;
  const bufferFrames = Math.max(1, Math.round(mixLength * ctx.sampleRate));
  const mixBuffer = ctx.createBuffer(LOOP_MIX_CHANNELS, bufferFrames, ctx.sampleRate);

  if (!mixLength) {
    return mixBuffer;
  }

  const accumulators = [
    new Float32Array(mixBuffer.length),
    new Float32Array(mixBuffer.length),
  ];

  const readyClips = providedClips || getReadyClipsWithTime(appState);
  const overlappingClips = readyClips.filter((clip) => (
    intervalsOverlap(mixStart, mixEnd, clip.startTimeSec, clip.endTimeSec)
  ));

  for (const clip of overlappingClips) {
    const clipStart = clip.startTimeSec;
    const clipEnd = clip.endTimeSec;
    const overlapStart = Math.max(mixStart, clipStart);
    const overlapEnd = Math.min(mixEnd, clipEnd);
    if (overlapEnd <= overlapStart) {
      continue;
    }

    const overlapLength = overlapEnd - overlapStart;
    const sourceBuffer = clip.buffer;
    const overlapSourceStartSec = overlapStart - clipStart;
    const destStartSec = overlapStart - mixStart;
    const destStartFrame = Math.max(0, Math.floor(destStartSec * ctx.sampleRate));
    const destFrames = Math.min(
      Math.floor(overlapLength * ctx.sampleRate),
      mixBuffer.length - destStartFrame,
    );
    if (destFrames <= 0 || sourceBuffer.length === 0) {
      continue;
    }

    const sourceFrameIncrement = sourceBuffer.sampleRate / ctx.sampleRate;
    let sourceFrame = overlapSourceStartSec * sourceBuffer.sampleRate;
    const sourceFrameLimit = Math.min(sourceBuffer.length - 1, sourceFrame + overlapLength * sourceBuffer.sampleRate);

    for (let frame = 0; frame < destFrames; frame += 1) {
      const destinationFrame = destStartFrame + frame;
      if (sourceFrame > sourceFrameLimit) {
        break;
      }

      for (let channel = 0; channel < LOOP_MIX_CHANNELS; channel += 1) {
        const sourceChannel = Math.min(channel, sourceBuffer.numberOfChannels - 1);
        const sourceData = sourceBuffer.getChannelData(sourceChannel);
        accumulators[channel][destinationFrame] = softClipSample(
          accumulators[channel][destinationFrame] + readSampleAtFrame(sourceData, sourceFrame),
        );
      }

      sourceFrame += sourceFrameIncrement;
    }
  }

  mixBuffer.copyToChannel(accumulators[0], 0);
  if (LOOP_MIX_CHANNELS > 1) {
    mixBuffer.copyToChannel(accumulators[1], 1);
  }

  return mixBuffer;
}

function buildLoopMixBuffer(appState) {
  if (!appState.audio.context || appState.loopRegionStartSec == null || appState.loopRegionLengthSec <= 0) {
    return null;
  }

  return buildMixedBufferForWindow(
    appState,
    appState.loopRegionStartSec,
    appState.loopRegionLengthSec,
  );
}

function buildSessionPlaybackBuffer(appState) {
  if (!appState.audio.context) {
    return null;
  }

  const readyClips = getReadyClipsWithTime(appState);
  if (!readyClips.length) {
    return null;
  }

  const sessionStartSec = Math.min(...readyClips.map((clip) => clip.startTimeSec));
  const sessionEndSec = Math.max(...readyClips.map((clip) => clip.endTimeSec));
  const sessionLengthSec = sessionEndSec - sessionStartSec;

  if (!Number.isFinite(sessionLengthSec) || sessionLengthSec <= 0) {
    return null;
  }

  const buffer = buildMixedBufferForWindow(appState, sessionStartSec, sessionLengthSec, readyClips);
  if (!buffer) {
    return null;
  }

  return {
    buffer,
    sessionStartSec,
    sessionLengthSec,
  };
}

function getSessionRange(appState) {
  const readyClips = getReadyClipsWithTime(appState);
  if (!readyClips.length) {
    return null;
  }

  const sessionStartSec = Math.min(...readyClips.map((clip) => clip.startTimeSec));
  const sessionEndSec = Math.max(...readyClips.map((clip) => clip.endTimeSec));
  if (!Number.isFinite(sessionStartSec) || !Number.isFinite(sessionEndSec) || sessionEndSec <= sessionStartSec) {
    return null;
  }

  return { sessionStartSec, sessionEndSec };
}

function getLoopMarkerTimeSec(appState) {
  if (appState.isPlaybackPlaying || appState.isPlaybackPaused) {
    const baseStartSec = appState.playback.baseStartSec || 0;
    return baseStartSec + currentPlaybackOffset(appState);
  }
  if (Number.isFinite(appState.playbackPlayheadSec)) {
    return appState.playbackPlayheadSec;
  }
  return 0;
}

export async function ensureContext(appState) {
  if (!appState.audio.context) {
    appState.audio.context = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    const ctx = appState.audio.context;
    appState.audio.playbackGain = ctx.createGain();
    appState.audio.inputGain = appState.audio.playbackGain;
    appState.audio.master = ctx.createGain();
    appState.audio.echoReverbNode = ctx.createScriptProcessor(1024, LOOP_MIX_CHANNELS, LOOP_MIX_CHANNELS);
    appState.audio.echoReverbState = createEchoReverbState(
      ctx.sampleRate,
      LOOP_MIX_CHANNELS,
      appState.effects.reverb.params,
    );
    appState.audio.distortionSend = ctx.createGain();
    appState.audio.distortionNode = ctx.createWaveShaper();
    appState.audio.distortionWet = ctx.createGain();
    appState.audio.safetyCompressor = ctx.createDynamicsCompressor();
    appState.audio.levelAnalyser = ctx.createAnalyser();
    appState.audio.levelAnalyser.fftSize = 512;
    appState.audio.levelAnalyser.smoothingTimeConstant = 0.85;
    appState.meterData = new Uint8Array(appState.audio.levelAnalyser.fftSize);

    appState.audio.playbackGain.connect(appState.audio.echoReverbNode);
    appState.audio.echoReverbNode.connect(appState.audio.master);
    appState.audio.master.connect(appState.audio.safetyCompressor);
    appState.audio.safetyCompressor.connect(ctx.destination);

    appState.audio.playbackGain.connect(appState.audio.distortionSend);
    appState.audio.distortionSend.connect(appState.audio.distortionNode);
    appState.audio.distortionNode.connect(appState.audio.distortionWet);
    appState.audio.distortionWet.connect(appState.audio.master);

    appState.audio.echoReverbNode.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const outputBuffer = event.outputBuffer;
      const channelCount = outputBuffer.numberOfChannels;
      const inputChannelCount = Math.max(1, inputBuffer.numberOfChannels);
      const inputChannels = [];
      const outputChannels = [];
      for (let channel = 0; channel < channelCount; channel += 1) {
        inputChannels.push(inputBuffer.getChannelData(Math.min(channel, inputChannelCount - 1)));
        outputChannels.push(outputBuffer.getChannelData(channel));
      }

      processEchoReverbBlock(
        appState.audio.echoReverbState,
        inputChannels,
        outputChannels,
        outputBuffer.length,
        appState.effects.reverb.enabled,
      );
    };

    appState.audio.safetyCompressor.threshold.value = -15;
    appState.audio.safetyCompressor.knee.value = 12;
    appState.audio.safetyCompressor.ratio.value = 10;
    appState.audio.safetyCompressor.attack.value = 0.003;
    appState.audio.safetyCompressor.release.value = 0.25;
  }

  if (appState.audio.context.state === 'suspended') {
    await appState.audio.context.resume();
  }

  updateEffectsNodes(appState);
}

export function updateEffectsNodes(appState) {
  if (!appState.audio.context || !appState.audio.playbackGain || !appState.audio.distortionNode) {
    return;
  }

  setEchoReverbParams(appState.audio.echoReverbState, appState.effects.reverb.params);

  const ctx = appState.audio.context;
  const distortion = appState.effects.distortion;
  appState.audio.distortionNode.curve = buildDistortionCurve(DISTORTION_DRIVE);
  appState.audio.distortionNode.oversample = '4x';
  rampGainValue(appState.audio.distortionSend, distortion.enabled ? 1 : 0, ctx);
  rampGainValue(appState.audio.distortionWet, distortion.enabled ? DISTORTION_WET_GAIN : 0, ctx);

}

export function startMeter(appState, onLevelChange) {
  if (appState.audio.meterFrame) {
    return;
  }

  const tick = () => {
    if (!appState.meterData || !appState.audio.levelAnalyser) {
      appState.audio.meterFrame = requestAnimationFrame(tick);
      return;
    }

    appState.audio.levelAnalyser.getByteTimeDomainData(appState.meterData);
    let sum = 0;
    for (let i = 0; i < appState.meterData.length; i += 1) {
      const v = (appState.meterData[i] - 128) / 128;
      sum += v * v;
    }

    const rms = Math.sqrt(sum / appState.meterData.length);
    const percent = Math.min(100, Math.round(rms * 250));
    onLevelChange(percent);
    appState.audio.meterFrame = requestAnimationFrame(tick);
  };

  appState.audio.meterFrame = requestAnimationFrame(tick);
}

export function stopMeter(appState, onLevelChange) {
  if (appState.audio.meterFrame) {
    cancelAnimationFrame(appState.audio.meterFrame);
    appState.audio.meterFrame = null;
  }
  onLevelChange(0);
}

export async function enableMic(appState, onMeterLevel) {
  if (appState.micEnabled) {
    return;
  }

  await ensureContext(appState);

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser does not support getUserMedia.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });

  appState.mediaStream = stream;
  appState.audio.micSource = appState.audio.context.createMediaStreamSource(stream);
  appState.audio.micSource.connect(appState.audio.levelAnalyser);

  const mime = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
    ? 'audio/webm; codecs=opus'
    : 'audio/webm';
  appState.mediaRecorder = new MediaRecorder(stream, { mimeType: mime });

  appState.mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      appState.recordingChunks.push(event.data);
    }
  };

  appState.mediaRecorder.onstop = () => {
    finalizeRecording(appState).catch((error) => {
      console.error('finalize recording failed', error);
      appState.pendingStatusMessage = error.message || 'Could not finalize recording.';
      appState.recordingActive = false;
      appState.recordingClipId = null;
    });
  };

  appState.micEnabled = true;
  appState.audioReady = true;
  appState.playback.source = null;
  appState.pendingStatusMessage = 'Mic enabled. You can record now.';
  startMeter(appState, onMeterLevel);
}

export function setMonitoringEnabled(appState, enabled) {
  appState.monitoringEnabled = !!enabled;
}

function refreshLoopTransportIfNeeded(appState, preserveOffset = 0) {
  if (!appState.isLooping || !appState.loopRegionLengthSec) {
    return;
  }

  appState.loopMixBuffer = buildLoopMixBuffer(appState);
  if (!appState.isPlaybackPlaying || !appState.loopMixBuffer) {
    if (appState.isPlaybackPaused) {
      appState.playbackPausedOffset = modulo(preserveOffset, appState.loopRegionLengthSec || 1);
    }
    return;
  }

  const stableOffset = modulo(preserveOffset, appState.loopRegionLengthSec);
  stopTransport(appState, 'replace');
  startLoopTransport(appState, stableOffset);
}

function startLoopTransport(appState, offsetSec = 0) {
  if (!appState.loopMixBuffer) {
    return false;
  }

  if (appState.loopRegionLengthSec == null || appState.loopRegionLengthSec <= 0 || appState.loopRegionStartSec == null) {
    return false;
  }

  const loopOffset = modulo(offsetSec, appState.loopRegionLengthSec || appState.loopMixBuffer.duration || 1);
  return createTransport(appState, appState.loopMixBuffer, {
    clipId: null,
    baseStartSec: appState.loopRegionStartSec || 0,
    loop: true,
    loopStart: 0,
    loopEnd: appState.loopRegionLengthSec,
    offset: loopOffset,
    mode: 'loop',
    preserveLoopingState: true,
  });
}

export function startRecording(appState) {
  if (!appState.micEnabled || !appState.mediaRecorder || appState.recordingActive) {
    return false;
  }

  if (!appState.audio.context) {
    throw new Error('Audio context is not ready.');
  }

  if (appState.sessionStartSec == null) {
    appState.sessionStartSec = nowMs() / 1000;
  }

  const startSec = getRecordingStartSec(appState);
  const resolvedStart = Number(startSec.toFixed(3));
  const useDedicatedLoopTrack = loopRecordingStartSec(appState) != null;
  const selectedTrackId = useDedicatedLoopTrack
    ? createNewTrack(appState)
    : getTrackForRecordingStart(appState, startSec);
  const clipNumber = appState.nextClipIndex;
  const clip = {
    id: `clip-${clipNumber}`,
    trackId: selectedTrackId,
    startTimeSec: resolvedStart,
    endTimeSec: null,
    duration: 0,
    label: `Take ${clipNumber}`,
    status: 'recording',
    blob: null,
    buffer: null,
    lockTrack: useDedicatedLoopTrack,
    maxDurationSec: useDedicatedLoopTrack ? appState.loopRegionLengthSec : null,
  };

  appState.nextClipIndex += 1;
  appState.clips.push(clip);
  appState.selectedClipId = clip.id;
  appState.recordingClipId = clip.id;
  appState.activeTrackId = selectedTrackId;
  appState.recordingChunks = [];
  appState.recordingStart = nowMs();
  appState.recordingActive = true;
  clearRecordingAutoStop(appState);

  if (!appState.mediaRecorder || appState.mediaRecorder.state !== 'inactive') {
    throw new Error('Recorder not ready for a new recording.');
  }

  try {
    appState.mediaRecorder.start();
    if (useDedicatedLoopTrack && clip.maxDurationSec > 0) {
      const maxMs = Math.max(1, Math.round(clip.maxDurationSec * 1000));
      appState.recordingAutoStopTimer = setTimeout(() => {
        if (!appState.recordingActive || !appState.mediaRecorder || appState.mediaRecorder.state !== 'recording') {
          return;
        }
        try {
          appState.mediaRecorder.stop();
        } catch (_) {
          // Ignore invalid state errors.
        }
      }, maxMs);
    }
  } catch (error) {
    clearRecordingAutoStop(appState);
    appState.clips = appState.clips.filter((existing) => existing.id !== clip.id);
    appState.recordingActive = false;
    appState.recordingClipId = null;
    appState.selectedClipId = null;
    throw error;
  }

  appState.pendingStatusMessage = `Recording ${clip.label} on ${appState.activeTrackId}...`;
  return true;
}

export async function finalizeRecording(appState) {
  clearRecordingAutoStop(appState);
  const recordingClip = getClipById(appState, appState.recordingClipId);
  const target = recordingClip || appState.clips[appState.clips.length - 1] || null;

  if (!target) {
    appState.recordingActive = false;
    appState.recordingClipId = null;
    return null;
  }

  const elapsedMs = Math.max(0, nowMs() - appState.recordingStart);
  const blob = new Blob(appState.recordingChunks, {
    type: appState.mediaRecorder?.mimeType || 'audio/webm',
  });
  appState.recordingChunks = [];

  const wasLooping = appState.isLooping;
  const preserveLoopOffset = appState.isPlaybackPlaying ? currentPlaybackOffset(appState) : appState.playbackPausedOffset;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await appState.audio.context.decodeAudioData(arrayBuffer.slice(0));
    const rawDuration = Math.max(elapsedMs / 1000, audioBuffer.duration || 0);
    const durationCap = Number.isFinite(target.maxDurationSec) && target.maxDurationSec > 0
      ? target.maxDurationSec
      : Infinity;
    const duration = Number(Math.min(rawDuration, durationCap).toFixed(2));
    const clipStart = target.startTimeSec;

    target.blob = blob;
    target.buffer = audioBuffer;
    target.duration = duration;
    const clipEnd = Number((clipStart + duration).toFixed(3));
    target.endTimeSec = clipEnd;
    target.status = 'ready';

    assignClipToNonOverlappingTrack(appState, target);

    appState.recordingActive = false;
    appState.recordingClipId = null;
    appState.selectedClipId = target.id;
    appState.pendingStatusMessage = `Recorded ${target.label} (${duration.toFixed(2)}s).`;

    if (wasLooping) {
      refreshLoopTransportIfNeeded(appState, preserveLoopOffset);
    }

    appState.onTransportEnded?.();
    return target;
  } catch (error) {
    console.error('decode failed', error);
    appState.clips = appState.clips.filter((clip) => clip.id !== target.id);
    appState.recordingActive = false;
    appState.recordingClipId = null;
    appState.pendingStatusMessage = 'Could not decode recording. Please retry.';
    appState.onTransportEnded?.();
    throw error;
  }
}

export function endRecording(appState) {
  if (!appState.recordingActive || !appState.mediaRecorder) {
    return false;
  }
  clearRecordingAutoStop(appState);
  appState.mediaRecorder.stop();
  return true;
}

export function currentPlaybackOffset(appState) {
  if (!appState.playback.source || !appState.audio.context || !appState.playback.duration) {
    return appState.isPlaybackPaused ? appState.playbackPausedOffset : appState.playback.startOffset || 0;
  }

  const clip = getClipById(appState, appState.playback.clipId);
  if (clip && !clip.duration) {
    return 0;
  }

  const elapsed = (appState.audio.context.currentTime - appState.playback.startedAt) * appState.playback.playbackRate;
  const rawOffset = appState.playback.startOffset + elapsed;

  if (appState.playback.loop) {
    return modulo(rawOffset, appState.playback.duration);
  }

  return clamp(rawOffset, 0, appState.playback.duration);
}

export function updatePlayheadPosition(appState) {
  if (!appState.isPlaybackPlaying || !appState.playback.source || !appState.audio.context) {
    return;
  }

  const elapsed = (appState.audio.context.currentTime - appState.playback.startedAt) * appState.playback.playbackRate;
  const rawOffset = appState.playback.startOffset + elapsed;
  const baseStart = appState.playback.baseStartSec || 0;

  if (appState.playback.loop) {
    const loopLength = appState.playback.duration || appState.loopRegionLengthSec || 0;
    if (!loopLength) {
      appState.playbackPlayheadSec = baseStart;
      return;
    }
    appState.playbackPlayheadSec = baseStart + modulo(rawOffset, loopLength);
    return;
  }

  appState.playbackPlayheadSec = baseStart + clamp(rawOffset, 0, appState.playback.duration || 0);
}

function createTransport(appState, buffer, options = {}) {
  if (!appState.audio.context || !buffer || !buffer.duration) {
    return false;
  }

  const {
    clipId = null,
    offset = 0,
    loop = false,
    loopStart = 0,
    loopEnd = buffer.duration,
    baseStartSec = 0,
    mode = 'clip',
    preserveLoopingState = loop,
  } = options;

  const source = appState.audio.context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  if (loop) {
    source.loopStart = clamp(loopStart, 0, buffer.duration);
    source.loopEnd = clamp(loopEnd, 0, buffer.duration);
  }

  const transportId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeOffset = loop
    ? modulo(offset, buffer.duration)
    : clamp(offset, 0, Math.max(0, buffer.duration - 0.000001));
  const rate = 1;

  source.connect(appState.audio.playbackGain);
  source.playbackRate.value = rate;
  appState.playback = {
    source,
    clipId,
    duration: buffer.duration,
    startOffset: safeOffset,
    startedAt: appState.audio.context.currentTime,
    playbackRate: rate,
    loop: loop,
    manualStopReason: 'none',
    transportId,
    baseStartSec,
    mode,
  };
  appState.activeTransportId = transportId;
  updateEffectsNodes(appState);

  const playbackStartOffset = safeOffset;
  source.onended = () => {
    if (appState.activeTransportId !== transportId) {
      return;
    }

    const reason = appState.playback.manualStopReason;
    const currentClip = getClipById(appState, appState.playback.clipId);
    const finalOffset = currentPlaybackOffset(appState);

    appState.playback.source = null;
    appState.playback.manualStopReason = 'none';
    appState.isPlaybackPlaying = false;

    if (reason === 'pause') {
      appState.isPlaybackPaused = true;
      appState.playbackPausedOffset = finalOffset;
      appState.isLooping = preserveLoopingState;
    } else {
      appState.isPlaybackPaused = false;
      appState.playbackPausedOffset = 0;
      appState.isLooping = false;
    }

    if (loop) {
      const loopLength = appState.loopRegionLengthSec || appState.playback.duration || 0;
      if (loopLength) {
        appState.playbackPlayheadSec = appState.playback.baseStartSec + modulo(finalOffset, loopLength);
      } else {
        appState.playbackPlayheadSec = appState.playback.baseStartSec;
      }
    } else if (appState.playback.mode === 'session') {
      if (reason === 'pause') {
        appState.playbackPlayheadSec = appState.playback.baseStartSec + clamp(finalOffset, 0, appState.playback.duration || 0);
      } else {
        appState.playbackPlayheadSec = appState.playback.baseStartSec + (appState.playback.duration || 0);
      }
    } else if (currentClip) {
      const clipDuration = currentClip.duration || 0;
      if (reason === 'pause') {
        appState.playbackPlayheadSec = currentClip.startTimeSec + clamp(finalOffset, 0, clipDuration);
      } else {
        appState.playbackPlayheadSec = currentClip.startTimeSec + clipDuration;
      }
    } else {
      appState.playbackPlayheadSec = appState.playback.baseStartSec;
    }

    appState.onTransportEnded?.();
  };

  source.start(0, playbackStartOffset);

  appState.isPlaybackPlaying = true;
  appState.isLooping = preserveLoopingState;
  appState.isPlaybackPaused = false;
  appState.playbackPausedOffset = 0;
  appState.playbackPlayheadSec = appState.playback.baseStartSec + playbackStartOffset;
  return true;
}

export function stopTransport(appState, reason = 'manual') {
  if (!appState.playback.source) {
    return;
  }

  appState.playback.manualStopReason = reason;

  const shouldFade = ['pause', 'manual', 'endLoop', 'replace', 'stop', 'stopLoop'].includes(reason);
  if (shouldFade) {
    try {
      appState.playback.source.stop(appState.audio.context.currentTime + STOP_FADE_SECONDS);
      return;
    } catch (_) {
      // Ignore invalid state errors.
    }
  }

  try {
    appState.playback.source.stop();
  } catch (_) {
    // Ignore invalid state errors.
  }
}

export function startPlayback(appState) {
  const sessionPlayback = buildSessionPlaybackBuffer(appState);
  if (!sessionPlayback) {
    throw new Error('No ready clip yet.');
  }

  const { buffer, sessionStartSec } = sessionPlayback;
  const offset = appState.isPlaybackPaused ? appState.playbackPausedOffset : 0;
  stopTransport(appState, 'replace');

  if (!createTransport(appState, buffer, {
    clipId: null,
    offset,
    loop: false,
    baseStartSec: sessionStartSec || 0,
    mode: 'session',
    preserveLoopingState: false,
  })) {
    throw new Error('Could not start playback.');
  }

  appState.isLooping = false;
  return { label: 'timeline' };
}

export function pausePlayback(appState) {
  if (!appState.isPlaybackPlaying || !appState.playback.source) {
    return false;
  }
  appState.playbackPausedOffset = currentPlaybackOffset(appState);
  stopTransport(appState, 'pause');
  return true;
}

export function resumePlayback(appState) {
  if (!appState.isPlaybackPaused || appState.isPlaybackPlaying) {
    return false;
  }

  const shouldLoopResume = appState.isLooping && appState.loopRegionLengthSec > 0;
  const resumeOffset = appState.playbackPausedOffset;
  stopTransport(appState, 'replace');

  if (shouldLoopResume) {
    if (!appState.loopMixBuffer) {
      appState.loopMixBuffer = buildLoopMixBuffer(appState);
    }
    if (startLoopTransport(appState, resumeOffset)) {
      return true;
    }
    throw new Error('Could not resume looping playback.');
  }

  const sessionPlayback = buildSessionPlaybackBuffer(appState);
  if (!sessionPlayback) {
    return false;
  }

  const { buffer, sessionStartSec } = sessionPlayback;
  if (!createTransport(appState, buffer, {
    clipId: null,
    offset: resumeOffset,
    loop: false,
    baseStartSec: sessionStartSec || 0,
    mode: 'session',
    preserveLoopingState: false,
  })) {
    throw new Error('Could not resume playback.');
  }

  appState.isLooping = false;
  return { label: 'timeline playback' };
}

export function startLoop(appState) {
  const sessionRange = getSessionRange(appState);
  if (!sessionRange) {
    throw new Error('No ready clip yet.');
  }

  const marker = clamp(
    getLoopMarkerTimeSec(appState),
    sessionRange.sessionStartSec,
    Math.max(sessionRange.sessionStartSec, sessionRange.sessionEndSec - MIN_LOOP_REGION_SECONDS),
  );
  appState.loopSelectionStartSec = Number(marker.toFixed(3));
  appState.pendingStatusMessage = `Loop start set at ${appState.loopSelectionStartSec.toFixed(2)}s. Click End Loop to set loop end.`;
  return { startSec: appState.loopSelectionStartSec };
}

export function endLoop(appState) {
  if (appState.isLooping && appState.loopSelectionStartSec == null) {
    const preserveOffset = currentPlaybackOffset(appState);
    stopTransport(appState, 'endLoop');
    appState.playbackPausedOffset = preserveOffset;
    appState.isLooping = false;
    appState.loopRegionStartSec = null;
    appState.loopRegionLengthSec = 0;
    appState.loopSelectionStartSec = null;
    appState.loopMixBuffer = null;
    return { mode: 'stop' };
  }

  if (appState.loopSelectionStartSec == null) {
    return false;
  }

  const sessionRange = getSessionRange(appState);
  if (!sessionRange) {
    throw new Error('No ready clip yet.');
  }

  const rawEndSec = clamp(
    getLoopMarkerTimeSec(appState),
    sessionRange.sessionStartSec,
    sessionRange.sessionEndSec,
  );
  const loopStartSec = appState.loopSelectionStartSec;
  if (rawEndSec - loopStartSec < MIN_LOOP_REGION_SECONDS) {
    throw new Error('Loop end must be after loop start.');
  }

  const currentPhase = clamp(rawEndSec - loopStartSec, 0, rawEndSec - loopStartSec);
  stopTransport(appState, 'replace');

  appState.loopRegionStartSec = loopStartSec;
  appState.loopRegionLengthSec = Number((rawEndSec - loopStartSec).toFixed(3));
  appState.loopSelectionStartSec = null;
  appState.loopMixBuffer = buildLoopMixBuffer(appState);

  if (!startLoopTransport(appState, currentPhase)) {
    throw new Error('Could not start loop.');
  }

  appState.isPlaybackPaused = false;
  return {
    mode: 'range',
    startSec: appState.loopRegionStartSec,
    endSec: Number((appState.loopRegionStartSec + appState.loopRegionLengthSec).toFixed(3)),
  };
}
