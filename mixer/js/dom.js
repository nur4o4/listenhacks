export const dom = {
  statusMessage: document.getElementById('statusMessage'),
  enableMicBtn: document.getElementById('enableMicBtn'),
  monitorToggle: document.getElementById('monitorToggle'),
  levelFill: document.getElementById('levelFill'),
  toggleHandTrackingBtn: document.getElementById('toggleHandTrackingBtn'),
  handTrackingVideo: document.getElementById('handTrackingVideo'),
  handTrackingCanvas: document.getElementById('handTrackingCanvas'),
  handTrackingState: document.getElementById('handTrackingState'),
  handGestureState: document.getElementById('handGestureState'),
  startRecordBtn: document.getElementById('startRecordBtn'),
  endRecordBtn: document.getElementById('endRecordBtn'),
  playbackBtn: document.getElementById('playbackBtn'),
  startLoopBtn: document.getElementById('startLoopBtn'),
  endLoopBtn: document.getElementById('endLoopBtn'),

  timelineScale: document.getElementById('timelineScale'),
  timelineScaleValue: document.getElementById('timelineScaleValue'),
  timelineAxis: document.getElementById('timelineAxis'),
  timelineAxisLane: document.getElementById('timelineAxisLane'),
  timelineViewport: document.getElementById('timelineViewport'),
  timelineTracks: document.getElementById('timelineTracks'),
  timelinePlayhead: document.getElementById('timelinePlayhead'),
  timelinePlayheadLayer: document.getElementById('timelinePlayheadLayer'),

  reverbEnabled: document.getElementById('reverbEnabled'),
  distortionEnabled: document.getElementById('distortionEnabled'),
  reverbDecay: document.getElementById('reverbDecay'),
  reverbDecayValue: document.getElementById('reverbDecayValue'),
  delayEnabled: document.getElementById('delayEnabled'),
  delayTime: document.getElementById('delayTime'),
  delayFeedback: document.getElementById('delayFeedback'),
  delayWet: document.getElementById('delayWet'),
  delayAdvanced: document.getElementById('delayAdvanced'),
  delayTimeValue: document.getElementById('delayTimeValue'),
  delayFeedbackValue: document.getElementById('delayFeedbackValue'),
  delayWetValue: document.getElementById('delayWetValue'),
  autotuneEnabled: document.getElementById('autotuneEnabled'),
  autotuneSemitones: document.getElementById('autotuneSemitones'),
  autotuneValue: document.getElementById('autotuneValue'),

  remoteStatus: document.getElementById('remoteStatus'),
  recordingState: document.getElementById('recordingState'),
  loopState: document.getElementById('loopState'),
  playbackState: document.getElementById('playbackState'),
  loopLength: document.getElementById('loopLength'),
};

export function setStatusMessage(text, isError = false) {
  dom.statusMessage.textContent = text || '';
  dom.statusMessage.style.color = isError ? '#ff8f9f' : '#ffd57a';
}
