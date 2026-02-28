import { clamp } from './utils.js';

const DEFAULT_ECHO = Object.freeze({
  delayMs: 240,
  feedback: 0.45,
  wet: 0.38,
  dry: 0.9,
});

const DEFAULT_REVERB = Object.freeze({
  roomSize: 0.74,
  damp: 0.35,
  wet: 0.3,
  earlyMix: 0.22,
});

const COMB_DELAY_MS = Object.freeze([30.1, 34.7, 39.6, 44.3]);
const ALLPASS_DELAY_MS = Object.freeze([5.0, 1.7]);
const EARLY_TAPS_MS = Object.freeze([7.0, 11.0, 17.0]);
const EARLY_GAINS = Object.freeze([0.6, 0.35, 0.2]);
const ALLPASS_GAIN = 0.7;

function msToSamples(sampleRate, ms) {
  return Math.max(1, Math.round((sampleRate * ms) / 1000));
}

function normalizeParams(params = {}) {
  const echoIn = params.echo || {};
  const reverbIn = params.reverb || {};
  return {
    echo: {
      delayMs: clamp(Number(echoIn.delayMs ?? DEFAULT_ECHO.delayMs), 20, 1000),
      feedback: clamp(Number(echoIn.feedback ?? DEFAULT_ECHO.feedback), 0, 0.99),
      wet: clamp(Number(echoIn.wet ?? DEFAULT_ECHO.wet), 0, 1),
      dry: clamp(Number(echoIn.dry ?? DEFAULT_ECHO.dry), 0, 1),
    },
    reverb: {
      roomSize: clamp(Number(reverbIn.roomSize ?? DEFAULT_REVERB.roomSize), 0, 0.98),
      damp: clamp(Number(reverbIn.damp ?? DEFAULT_REVERB.damp), 0.2, 0.6),
      wet: clamp(Number(reverbIn.wet ?? DEFAULT_REVERB.wet), 0.2, 0.5),
      earlyMix: clamp(Number(reverbIn.earlyMix ?? DEFAULT_REVERB.earlyMix), 0, 0.5),
    },
  };
}

export function createEchoReverbState(sampleRate, channels = 2, params = {}) {
  const normalized = normalizeParams(params);
  const channelCount = Math.max(1, channels | 0);
  const echoSamples = msToSamples(sampleRate, normalized.echo.delayMs);
  const combDelays = COMB_DELAY_MS.map((ms) => msToSamples(sampleRate, ms));
  const allpassDelays = ALLPASS_DELAY_MS.map((ms) => msToSamples(sampleRate, ms));
  const earlyTapSamples = EARLY_TAPS_MS.map((ms) => msToSamples(sampleRate, ms));
  const earlyMaxDelay = Math.max(...earlyTapSamples, 1);

  const echoBuffers = Array.from({ length: channelCount }, () => new Float32Array(echoSamples));
  const combBuffers = Array.from({ length: channelCount }, () => (
    combDelays.map((delay) => new Float32Array(delay))
  ));
  const combIndices = Array.from({ length: channelCount }, () => (
    combDelays.map(() => 0)
  ));
  const combLpStates = Array.from({ length: channelCount }, () => (
    combDelays.map(() => 0)
  ));
  const allpassBuffers = Array.from({ length: channelCount }, () => (
    allpassDelays.map((delay) => new Float32Array(delay))
  ));
  const allpassIndices = Array.from({ length: channelCount }, () => (
    allpassDelays.map(() => 0)
  ));
  const earlyBuffers = Array.from({ length: channelCount }, () => new Float32Array(earlyMaxDelay + 1));

  return {
    sampleRate,
    channels: channelCount,
    params: normalized,
    echoBuffers,
    echoIndex: 0,
    combBuffers,
    combIndices,
    combLpStates,
    allpassBuffers,
    allpassIndices,
    earlyBuffers,
    earlyTapSamples,
    earlyIndex: 0,
  };
}

export function setEchoReverbParams(effectState, params = {}) {
  effectState.params = normalizeParams(params);
}

export function processEchoReverbBlock(effectState, inputChannels, outputChannels, frameCount, enabled) {
  const { echo, reverb } = effectState.params;
  const channelCount = outputChannels.length;
  const echoLen = effectState.echoBuffers[0].length;
  const earlyLen = effectState.earlyBuffers[0].length;

  for (let i = 0; i < frameCount; i += 1) {
    for (let ch = 0; ch < channelCount; ch += 1) {
      const input = inputChannels[Math.min(ch, inputChannels.length - 1)];
      const x = clamp((input && Number.isFinite(input[i]) ? input[i] : 0) || 0, -1, 1);

      if (!enabled) {
        outputChannels[ch][i] = x;
        continue;
      }

      // Echo with persistent circular delay line per channel.
      const echoBuffer = effectState.echoBuffers[ch];
      const delayed = echoBuffer[effectState.echoIndex];
      echoBuffer[effectState.echoIndex] = x + echo.feedback * delayed;
      const echoOut = clamp(echo.dry * x + echo.wet * delayed, -1, 1);

      // Optional early reflections.
      const earlyBuffer = effectState.earlyBuffers[ch];
      earlyBuffer[effectState.earlyIndex] = echoOut;
      let early = echoOut;
      let earlyGainSum = 1;
      for (let tap = 0; tap < effectState.earlyTapSamples.length; tap += 1) {
        const tapDelay = effectState.earlyTapSamples[tap];
        const tapGain = EARLY_GAINS[tap];
        const tapIndex = (effectState.earlyIndex - tapDelay + earlyLen) % earlyLen;
        early += tapGain * earlyBuffer[tapIndex];
        earlyGainSum += tapGain;
      }
      const reverbInput = (1 - reverb.earlyMix) * echoOut + reverb.earlyMix * (early / earlyGainSum);

      // 4 parallel feedback comb filters with damping one-pole in feedback path.
      let combSum = 0;
      const combBufferSet = effectState.combBuffers[ch];
      const combIndexSet = effectState.combIndices[ch];
      const combLpSet = effectState.combLpStates[ch];
      for (let c = 0; c < combBufferSet.length; c += 1) {
        const buffer = combBufferSet[c];
        const idx = combIndexSet[c];
        const buf = buffer[idx];
        const fbLp = (1 - reverb.damp) * buf + reverb.damp * combLpSet[c];
        combLpSet[c] = fbLp;
        buffer[idx] = reverbInput + reverb.roomSize * fbLp;
        combSum += buf;
        combIndexSet[c] = (idx + 1) % buffer.length;
      }
      let reverbOut = combSum / combBufferSet.length;

      // 2 serial all-pass filters.
      const allpassBufferSet = effectState.allpassBuffers[ch];
      const allpassIndexSet = effectState.allpassIndices[ch];
      for (let a = 0; a < allpassBufferSet.length; a += 1) {
        const apBuffer = allpassBufferSet[a];
        const idx = allpassIndexSet[a];
        const buf = apBuffer[idx];
        const y = -ALLPASS_GAIN * reverbOut + buf;
        apBuffer[idx] = reverbOut + ALLPASS_GAIN * y;
        reverbOut = y;
        allpassIndexSet[a] = (idx + 1) % apBuffer.length;
      }

      const y = clamp((1 - reverb.wet) * echoOut + reverb.wet * reverbOut, -1, 1);
      outputChannels[ch][i] = y;
    }

    effectState.echoIndex = (effectState.echoIndex + 1) % echoLen;
    effectState.earlyIndex = (effectState.earlyIndex + 1) % earlyLen;
  }
}

export function runEchoReverbOfflineSelfTest() {
  const sampleRate = 48000;
  const frames = sampleRate;
  const block = 128;
  const params = {
    echo: { delayMs: 180, feedback: 0.5, wet: 0.42, dry: 0.85 },
    reverb: { roomSize: 0.78, damp: 0.35, wet: 0.34, earlyMix: 0.2 },
  };

  // Impulse response test: output should differ and ring out beyond sample 0.
  const impulse = new Float32Array(frames);
  impulse[0] = 1;
  const impulseOut = new Float32Array(frames);
  const impulseState = createEchoReverbState(sampleRate, 1, params);
  for (let offset = 0; offset < frames; offset += block) {
    const size = Math.min(block, frames - offset);
    const inView = impulse.subarray(offset, offset + size);
    const outView = impulseOut.subarray(offset, offset + size);
    processEchoReverbBlock(impulseState, [inView], [outView], size, true);
  }

  let identical = true;
  let tailEnergy = 0;
  for (let i = 0; i < frames; i += 1) {
    if (Math.abs(impulseOut[i] - impulse[i]) > 1e-6) {
      identical = false;
    }
    if (i > 0) {
      tailEnergy += Math.abs(impulseOut[i]);
    }
  }
  if (identical || tailEnergy <= 1e-5) {
    throw new Error('Impulse self-test failed: effect output has no audible tail.');
  }

  // Sine stability test: output must stay in [-1, 1].
  const sineIn = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    sineIn[i] = 0.7 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }
  const sineOut = new Float32Array(frames);
  const sineState = createEchoReverbState(sampleRate, 1, params);
  for (let offset = 0; offset < frames; offset += block) {
    const size = Math.min(block, frames - offset);
    processEchoReverbBlock(
      sineState,
      [sineIn.subarray(offset, offset + size)],
      [sineOut.subarray(offset, offset + size)],
      size,
      true,
    );
  }
  for (let i = 0; i < frames; i += 1) {
    if (sineOut[i] < -1.000001 || sineOut[i] > 1.000001) {
      throw new Error('Sine self-test failed: output exceeded [-1, 1].');
    }
  }

  return true;
}
