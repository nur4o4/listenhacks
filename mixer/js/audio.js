import { clamp, modulo, nowMs, nowSessionSec } from './utils.js';
import { getClipById, getTransportClip } from './state.js';

function buildReverbBuffer(appState, decay) {
  const ctx = appState.audio.context;
  const seconds = clamp(decay, 0.2, 8);
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      const decayEnvelope = Math.pow(1 - i / data.length, seconds);
      data[i] = (Math.random() * 2 - 1) * decayEnvelope;
    }
  }
  return impulse;
}

function playbackRateFromAutotune(appState) {
  if (!appState.effects.autotune.enabled) {
    return 1;
  }
  return Math.pow(2, appState.effects.autotune.semitones / 12);
}

const EFFECT_RAMP_SECONDS = 0.06;
const STOP_FADE_SECONDS = 0.07;
const OVERLAP_EPSILON = 0.0005;
const LOOP_MIX_CHANNELS = 2;
const SOFT_CLIP_GAIN = 1.15;

export function delayFeedbackMax(delayState) {
  return delayState?.advancedClamp ? 0.75 : 0.65;
}

export function getDelayFeedbackMax(delayState) {
  return delayFeedbackMax(delayState);
}

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

function fadeDelayLoopOut(appState) {
  if (!appState.audio.context || !appState.audio.delayWet || !appState.audio.delayFeedback) {
    return;
  }

  const ctx = appState.audio.context;
  rampGainValue(appState.audio.delayWet, 0, ctx, STOP_FADE_SECONDS);
  rampGainValue(appState.audio.delayFeedback, 0, ctx, STOP_FADE_SECONDS);
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

function assignClipToNonOverlappingTrack(appState, clip) {
  if (!clip || clip.status !== 'ready' || clip.startTimeSec == null || clip.endTimeSec == null) {
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

function getRecordingStartSec(appState) {
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

function buildLoopMixBuffer(appState) {
  if (!appState.audio.context || appState.loopRegionStartSec == null || appState.loopRegionLengthSec <= 0) {
    return null;
  }

  const ctx = appState.audio.context;
  const loopStart = appState.loopRegionStartSec;
  const loopLength = appState.loopRegionLengthSec;
  const loopEnd = loopStart + loopLength;
  const bufferFrames = Math.max(1, Math.round(loopLength * ctx.sampleRate));
  const loopBuffer = ctx.createBuffer(LOOP_MIX_CHANNELS, bufferFrames, ctx.sampleRate);

  if (!loopLength) {
    return loopBuffer;
  }

  const accumulators = [
    new Float32Array(loopBuffer.length),
    new Float32Array(loopBuffer.length),
  ];

  const overlappingClips = appState.clips.filter((clip) => {
    if (clip.status !== 'ready' || !clip.buffer || clip.startTimeSec == null || clip.endTimeSec == null) {
      return false;
    }

    return intervalsOverlap(loopStart, loopEnd, clip.startTimeSec, clip.endTimeSec);
  });

  for (const clip of overlappingClips) {
    const clipStart = clip.startTimeSec;
    const clipEnd = clip.endTimeSec;
    const overlapStart = Math.max(loopStart, clipStart);
    const overlapEnd = Math.min(loopEnd, clipEnd);
    if (overlapEnd <= overlapStart) {
      continue;
    }

    const overlapLength = overlapEnd - overlapStart;
    const sourceBuffer = clip.buffer;
    const overlapSourceStartSec = overlapStart - clipStart;
    const destStartSec = overlapStart - loopStart;
    const destStartFrame = Math.max(0, Math.floor(destStartSec * ctx.sampleRate));
    const destFrames = Math.min(
      Math.floor(overlapLength * ctx.sampleRate),
      loopBuffer.length - destStartFrame,
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

  loopBuffer.copyToChannel(accumulators[0], 0);
  if (LOOP_MIX_CHANNELS > 1) {
    loopBuffer.copyToChannel(accumulators[1], 1);
  }

  return loopBuffer;
}

function selectedClipForLoop(appState) {
  if (!appState.selectedClipId) {
    return getTransportClip(appState);
  }

  const selected = getClipById(appState, appState.selectedClipId);
  if (selected?.status === 'ready') {
    return selected;
  }

  return getTransportClip(appState);
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
    appState.audio.dryBus = ctx.createGain();
    appState.audio.master = ctx.createGain();

    appState.audio.reverbSend = ctx.createGain();
    appState.audio.reverbWet = ctx.createGain();
    appState.audio.delaySend = ctx.createGain();
    appState.audio.delayInput = ctx.createGain();
    appState.audio.delayNode = ctx.createDelay(2);
    appState.audio.delayFeedback = ctx.createGain();
    appState.audio.delayFeedbackFilter = ctx.createBiquadFilter();
    appState.audio.delayWet = ctx.createGain();
    appState.audio.safetyCompressor = ctx.createDynamicsCompressor();
    appState.audio.reverbNode = ctx.createConvolver();
    appState.audio.levelAnalyser = ctx.createAnalyser();
    appState.audio.levelAnalyser.fftSize = 512;
    appState.audio.levelAnalyser.smoothingTimeConstant = 0.85;
    appState.meterData = new Uint8Array(appState.audio.levelAnalyser.fftSize);

    appState.audio.playbackGain.connect(appState.audio.dryBus);
    appState.audio.dryBus.connect(appState.audio.master);
    appState.audio.master.connect(appState.audio.safetyCompressor);
    appState.audio.safetyCompressor.connect(ctx.destination);

    appState.audio.playbackGain.connect(appState.audio.reverbSend);
    appState.audio.reverbSend.connect(appState.audio.reverbNode);
    appState.audio.reverbNode.connect(appState.audio.reverbWet);
    appState.audio.reverbWet.connect(appState.audio.master);

    appState.audio.playbackGain.connect(appState.audio.delaySend);
    appState.audio.delaySend.connect(appState.audio.delayInput);
    appState.audio.delayInput.connect(appState.audio.delayNode);
    appState.audio.delayNode.connect(appState.audio.delayWet);
    appState.audio.delayNode.connect(appState.audio.delayFeedback);
    appState.audio.delayFeedback.connect(appState.audio.delayFeedbackFilter);
    appState.audio.delayFeedbackFilter.connect(appState.audio.delayInput);
    appState.audio.delayWet.connect(appState.audio.master);
    appState.audio.delayFeedbackFilter.type = 'lowpass';
    appState.audio.delayFeedbackFilter.frequency.value = 4200;
    appState.audio.delayFeedbackFilter.Q.value = 0.9;

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
  if (!appState.audio.context || !appState.audio.playbackGain || !appState.audio.reverbNode) {
    return;
  }

  const ctx = appState.audio.context;
  const reverb = appState.effects.reverb;
  const delay = appState.effects.delay;

  appState.audio.reverbNode.buffer = buildReverbBuffer(appState, reverb.decay);
  rampGainValue(appState.audio.reverbSend, reverb.enabled ? 1 : 0, ctx);
  rampGainValue(appState.audio.reverbWet, reverb.enabled ? reverb.wet : 0, ctx);

  const maxFeedback = delayFeedbackMax(delay);
  delay.feedback = clamp(delay.feedback, 0, maxFeedback);

  appState.audio.delayNode.delayTime.value = clamp(delay.delaySeconds, 0.05, 1.2);
  rampGainValue(appState.audio.delaySend, delay.enabled ? 1 : 0, ctx);
  rampGainValue(appState.audio.delayWet, delay.enabled ? delay.wet : 0, ctx);
  rampGainValue(appState.audio.delayFeedback, delay.enabled ? delay.feedback : 0, ctx);

  if (appState.effects.autotune.enabled && appState.playback.source) {
    const rate = playbackRateFromAutotune(appState);
    const now = ctx.currentTime;
    appState.playback.source.playbackRate.cancelScheduledValues(now);
    appState.playback.source.playbackRate.setValueAtTime(appState.playback.source.playbackRate.value, now);
    appState.playback.source.playbackRate.linearRampToValueAtTime(rate, now + EFFECT_RAMP_SECONDS);
    appState.playback.playbackRate = rate;
  } else if (!appState.effects.autotune.enabled && appState.playback.source) {
    const now = ctx.currentTime;
    appState.playback.source.playbackRate.cancelScheduledValues(now);
    appState.playback.source.playbackRate.setValueAtTime(appState.playback.source.playbackRate.value, now);
    appState.playback.source.playbackRate.linearRampToValueAtTime(1, now + EFFECT_RAMP_SECONDS);
    appState.playback.playbackRate = 1;
  }
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
  const selectedTrackId = getTrackForRecordingStart(appState, startSec);
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
  };

  appState.nextClipIndex += 1;
  appState.clips.push(clip);
  appState.selectedClipId = clip.id;
  appState.recordingClipId = clip.id;
  appState.activeTrackId = selectedTrackId;
  appState.recordingChunks = [];
  appState.recordingStart = nowMs();
  appState.recordingActive = true;

  if (!appState.mediaRecorder || appState.mediaRecorder.state !== 'inactive') {
    throw new Error('Recorder not ready for a new recording.');
  }

  try {
    appState.mediaRecorder.start();
  } catch (error) {
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
    const duration = Number(Math.max(elapsedMs / 1000, audioBuffer.duration || 0).toFixed(2));
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

  const clip = getClipById(appState, appState.playback.clipId);
  if (!clip || !clip.duration) {
    appState.playbackPlayheadSec = baseStart;
    return;
  }

  appState.playbackPlayheadSec = baseStart + clamp(rawOffset, 0, clip.duration);
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
  const rate = playbackRateFromAutotune(appState);

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
      appState.isLooping = loop;
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
  appState.isLooping = loop;
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
    fadeDelayLoopOut(appState);
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
  const clip = getTransportClip(appState);
  if (!clip) {
    throw new Error('No ready clip yet.');
  }

  appState.selectedClipId = clip.id;
  const offset = appState.isPlaybackPaused ? appState.playbackPausedOffset : 0;
  stopTransport(appState, 'replace');

  if (!createTransport(appState, clip.buffer, {
    clipId: clip.id,
    offset,
    loop: false,
    baseStartSec: clip.startTimeSec || 0,
  })) {
    throw new Error('Could not start playback.');
  }

  return clip;
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

  const clip = getTransportClip(appState);
  if (!clip) {
    return false;
  }

  if (!createTransport(appState, clip.buffer, {
    clipId: clip.id,
    offset: resumeOffset,
    loop: false,
    baseStartSec: clip.startTimeSec || 0,
  })) {
    throw new Error('Could not resume playback.');
  }

  return true;
}

export function startLoop(appState) {
  const clip = selectedClipForLoop(appState);
  if (!clip) {
    throw new Error('No ready clip yet.');
  }
  if (clip.status !== 'ready') {
    throw new Error('Select a ready clip first.');
  }

  const selectedStart = Number(clip.startTimeSec);
  const selectedLength = Number(clip.duration);
  if (!Number.isFinite(selectedStart) || !Number.isFinite(selectedLength) || selectedLength <= 0) {
    throw new Error('Selected clip has no valid duration.');
  }

  const currentPhase = appState.isPlaybackPlaying || appState.isPlaybackPaused
    ? modulo(currentPlaybackOffset(appState), selectedLength)
    : 0;
  stopTransport(appState, 'replace');

  appState.loopRegionStartSec = selectedStart;
  appState.loopRegionLengthSec = selectedLength;
  appState.loopMixBuffer = buildLoopMixBuffer(appState);

  if (!startLoopTransport(appState, currentPhase)) {
    throw new Error('Could not start loop.');
  }

  appState.selectedClipId = clip.id;
  appState.isPlaybackPaused = false;
  return clip;
}

export function endLoop(appState) {
  if (!appState.isLooping) {
    return false;
  }
  const preserveOffset = currentPlaybackOffset(appState);
  stopTransport(appState, 'endLoop');
  appState.playbackPausedOffset = preserveOffset;
  appState.isLooping = false;
  appState.loopRegionStartSec = null;
  appState.loopRegionLengthSec = 0;
  appState.loopMixBuffer = null;
  return true;
}
