export const dom = {
  statusMessage: document.getElementById('statusMessage'),
  enableMicBtn: document.getElementById('enableMicBtn'),
  monitorToggle: document.getElementById('monitorToggle'),
  levelFill: document.getElementById('levelFill'),
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

  eventLog: document.getElementById('eventLog'),

  activeTrackState: document.getElementById('activeTrackState'),
  micState: document.getElementById('micState'),
  selectedSnippet: document.getElementById('selectedSnippet'),
  remoteStatus: document.getElementById('remoteStatus'),
  reverbState: document.getElementById('reverbState'),
  delayState: document.getElementById('delayState'),
  autotuneState: document.getElementById('autotuneState'),
  recordingState: document.getElementById('recordingState'),
  loopState: document.getElementById('loopState'),
  playbackState: document.getElementById('playbackState'),
  loopLength: document.getElementById('loopLength'),
};

export function setStatusMessage(text, isError = false) {
  dom.statusMessage.textContent = text || '';
  dom.statusMessage.style.color = isError ? '#ff8f9f' : '#ffd57a';
}

export function renderEventLog(appState) {
  dom.eventLog.textContent = appState.actionLog.join('\n');
}
