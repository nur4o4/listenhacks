import { clamp, formatSeconds, nowSessionSec } from './utils.js';
import { getTransportClip } from './state.js';

function getClipVisualEndSec(appState, clip) {
  if (clip.status === 'ready') {
    return clip.endTimeSec ?? clip.startTimeSec;
  }
  if (appState.recordingActive && appState.recordingClipId === clip.id) {
    return nowSessionSec(appState);
  }
  return clip.endTimeSec ?? clip.startTimeSec;
}

function createEffectBadges(appState) {
  const wrap = document.createElement('span');
  wrap.className = 'clip-badges';

  if (appState.effects.reverb.enabled) {
    const badge = document.createElement('span');
    badge.className = 'clip-badge reverb';
    badge.textContent = 'R';
    wrap.appendChild(badge);
  }

  if (appState.effects.delay.enabled) {
    const badge = document.createElement('span');
    badge.className = 'clip-badge delay';
    badge.textContent = 'E';
    wrap.appendChild(badge);
  }

  if (appState.effects.autotune.enabled) {
    const badge = document.createElement('span');
    badge.className = 'clip-badge auto';
    badge.textContent = 'P';
    wrap.appendChild(badge);
  }

  return wrap.childElementCount ? wrap : null;
}

function getTrackLabelWidth() {
  const rootStyle = getComputedStyle(document.documentElement);
  return parseFloat(rootStyle.getPropertyValue('--trackLabelWidth')) || 90;
}

export function createClipElement(appState, clip, scale, onClipSelect) {
  const clipEl = document.createElement('button');
  clipEl.type = 'button';
  clipEl.className = `clip${clip.status === 'recording' ? ' recording' : ''}${
    clip.id === appState.selectedClipId ? ' selected' : ''
  }`;

  const endTime = getClipVisualEndSec(appState, clip);
  const width = Math.max(14, Math.max(0.01, endTime - clip.startTimeSec) * scale);
  clipEl.style.left = `${clip.startTimeSec * scale}px`;
  clipEl.style.width = `${width}px`;

  const label = document.createElement('span');
  label.className = 'clip-label';
  label.textContent = clip.label;

  const dur = document.createElement('span');
  dur.className = 'clip-duration';
  if (clip.status === 'ready') {
    dur.textContent = `${formatSeconds(clip.duration)}s`;
  } else {
    dur.textContent = 'rec';
  }

  if (clip.id === appState.selectedClipId) {
    const badges = createEffectBadges(appState);
    if (badges) {
      clipEl.appendChild(badges);
    }
  }

  clipEl.appendChild(label);
  clipEl.appendChild(dur);

  clipEl.addEventListener('click', () => {
    appState.selectedClipId = clip.id;
    appState.activeTrackId = clip.trackId;
    onClipSelect?.(clip);
  });

  return clipEl;
}

export function renderTimeline(appState, dom, onClipSelect, onTrackSelect) {
  const scale = appState.timeline.pixelsPerSecond;
  const nowSec = nowSessionSec(appState);
  const trackLabelWidth = getTrackLabelWidth();
  const axisLane = dom.timelineAxisLane || dom.timelineAxis;
  const playheadLayer = dom.timelinePlayheadLayer || dom.timelinePlayhead?.parentElement || dom.timelineTracks;
  const clipEndCandidates = appState.clips.map((clip) => {
    if (clip.status === 'ready') {
      return clip.endTimeSec;
    }
    if (clip.status === 'recording' && clip.id === appState.recordingClipId && appState.recordingActive) {
      return nowSec;
    }
    return clip.startTimeSec;
  });

  const maxEnd = Math.max(0, ...clipEndCandidates);
  const duration = Math.max(10, Math.ceil(maxEnd + 2));
  const viewportWidth = dom.timelineViewport.clientWidth || 900;
  const laneWidth = Math.max(0, viewportWidth - trackLabelWidth);
  const visibleLaneWidth = Math.max(laneWidth, duration * scale + 40);
  const laneColumnWidth = visibleLaneWidth;
  const width = trackLabelWidth + laneColumnWidth;

  dom.timelineAxis.style.width = `${width}px`;
  axisLane.style.width = `${laneColumnWidth}px`;
  dom.timelineTracks.style.width = `${width}px`;
  playheadLayer.style.left = `${trackLabelWidth}px`;
  playheadLayer.style.width = `${laneColumnWidth}px`;

  axisLane.innerHTML = '';
  for (let sec = 0; sec <= duration; sec += 1) {
    const tick = document.createElement('div');
    tick.className = 'time-tick';
    tick.style.left = `${sec * scale}px`;
    const tickLabel = document.createElement('span');
    tickLabel.textContent = String(sec);
    tick.appendChild(tickLabel);
    axisLane.appendChild(tick);
  }

  dom.timelineTracks.innerHTML = '';
  appState.tracks.forEach((track) => {
    const row = document.createElement('div');
    row.className = 'track-row';

    const trackNameCol = document.createElement('div');
    trackNameCol.className = 'track-label';

    const arm = document.createElement('button');
    arm.type = 'button';
    arm.className = `track-arm ${appState.activeTrackId === track.id ? 'active' : ''}`;
    arm.textContent = track.name;
    arm.addEventListener('click', () => {
      onTrackSelect?.(track);
    });

    trackNameCol.appendChild(arm);

    const lane = document.createElement('div');
    lane.className = 'track-lane';
    appState.clips
      .filter((clip) => clip.trackId === track.id)
      .forEach((clip) => lane.appendChild(createClipElement(appState, clip, scale, onClipSelect)));

    row.appendChild(trackNameCol);
    row.appendChild(lane);
    dom.timelineTracks.appendChild(row);
  });

  if (!appState.clips.length) {
    dom.timelinePlayhead.style.display = 'none';
    return;
  }

  const maxHeadSec = laneColumnWidth / scale;
  const clampedHead = clamp(appState.playbackPlayheadSec, 0, maxHeadSec);
  dom.timelinePlayhead.style.left = `${clampedHead * scale}px`;
  dom.timelinePlayhead.style.display = 'block';
  dom.timelinePlayhead.style.opacity = appState.isPlaybackPlaying ? '1' : '0.75';
}

export function getPlaybackTargetLabel(appState) {
  const active = getTransportClip(appState);
  if (active) {
    return `${active.label} (${formatSeconds(active.duration || 0)}s)`;
  }
  return 'none';
}
