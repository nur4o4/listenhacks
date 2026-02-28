import { dom } from './dom.js';
import { ACTION_ALLOWLIST, dispatchAction } from './actions.js';

const WS_URL = 'ws://localhost:3000/ws';
const MAX_SEEN_ACTIONS = 256;
let websocket = null;
let reconnectTimer = null;
const seenActionIds = new Set();
const seenOrder = [];

function setRemoteStatus(label, tone) {
  if (!dom.remoteStatus) {
    return;
  }

  dom.remoteStatus.textContent = label;
  dom.remoteStatus.classList.remove('remote-online', 'remote-offline', 'remote-connecting');
  if (tone) {
    dom.remoteStatus.classList.add(tone);
  }
}

function markActionId(actionId) {
  if (!actionId) {
    return;
  }
  if (seenActionIds.has(actionId)) {
    return;
  }

  seenActionIds.add(actionId);
  seenOrder.push(actionId);
  if (seenOrder.length > MAX_SEEN_ACTIONS) {
    const stale = seenOrder.shift();
    seenActionIds.delete(stale);
  }
}

function wasSeenAction(actionId) {
  return actionId && seenActionIds.has(actionId);
}

function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectTimer = setTimeout(() => {
    connectToBackend();
  }, 1500);
}

function handleMessage(event) {
  let action;

  try {
    const raw = typeof event.data === 'string' ? event.data : String(event.data);
    action = JSON.parse(raw);
  } catch (_) {
    console.warn('Remote action message was not valid JSON.');
    return;
  }

  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    return;
  }

  if (!ACTION_ALLOWLIST.has(action.type)) {
    console.warn(`Ignoring remote action with unknown type: ${action.type}`);
    return;
  }

  if (action.id && wasSeenAction(action.id)) {
    return;
  }
  markActionId(action.id);

  dispatchAction(actionAppState, {
    ...action,
    source: 'remote',
  }).catch((error) => {
    console.warn('Remote action failed', action.type, error);
  });
}

let actionAppState = null;

function connectToBackend() {
  if (!actionAppState) {
    return;
  }

  websocket = null;
  setRemoteStatus('connecting', 'remote-connecting');

  try {
    websocket = new WebSocket(WS_URL);
  } catch (_) {
    setRemoteStatus('disconnected', 'remote-offline');
    scheduleReconnect();
    return;
  }

  websocket.addEventListener('open', () => {
    setRemoteStatus('connected', 'remote-online');
  });

  websocket.addEventListener('message', handleMessage);

  websocket.addEventListener('close', () => {
    if (!actionAppState) {
      setRemoteStatus('disconnected', 'remote-offline');
      return;
    }
    setRemoteStatus('disconnected', 'remote-offline');
    scheduleReconnect();
  });

  websocket.addEventListener('error', () => {
    setRemoteStatus('disconnected', 'remote-offline');
    if (!websocket || websocket.readyState === WebSocket.CLOSING || websocket.readyState === WebSocket.CLOSED) {
      scheduleReconnect();
    }
  });
}

export function connectRemote(state) {
  actionAppState = state;
  setRemoteStatus('disconnected', 'remote-offline');
  connectToBackend();

  return {
    disconnect() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (!actionAppState) {
        return;
      }
      actionAppState = null;
      if (websocket) {
        websocket.close();
      }
      setRemoteStatus('disconnected', 'remote-offline');
    },
  };
}
