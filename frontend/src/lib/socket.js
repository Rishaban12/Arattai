const WS_URL = process.env.REACT_APP_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

let ws = null;
let listeners = [];
let reconnectTimer = null;
let heartbeatTimer = null;
let backoff = 1000;
let closedByUser = false;

// token is optional — the backend reads the HttpOnly access_token cookie first,
// which the browser attaches to the handshake automatically.
export function connectSocket(token, onMessage) {
  listeners.push(onMessage);
  closedByUser = false;

  function connect() {
    ws = new WebSocket(token ? `${WS_URL}?token=${token}` : WS_URL);
    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      listeners.forEach(fn => fn(data));
    };
    ws.onclose = () => {
      clearInterval(heartbeatTimer);
      if (closedByUser) return;
      reconnectTimer = setTimeout(() => { backoff = Math.min(backoff * 2, 30000); connect(); }, backoff);
    };
    ws.onopen = () => {
      backoff = 1000;
      // Heartbeat keeps the 60s presence:{userId} Redis key alive
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 30000);
    };
  }

  connect();

  return function disconnect() {
    listeners = listeners.filter(fn => fn !== onMessage);
    if (listeners.length === 0) {
      closedByUser = true;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      ws && ws.close();
      ws = null;
    }
  };
}

// Frame format matches the backend's ws.Frame: SEND_MESSAGE with `content`.
export function sendSocketMessage(chatId, text, clientMsgId, mediaUrl) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const frame = { type: 'SEND_MESSAGE', chatId, content: text || '', clientMsgId };
  if (mediaUrl) frame.mediaUrl = mediaUrl;
  ws.send(JSON.stringify(frame));
  return true;
}

// Marks the chat read up to lastReadId — clears the Redis unread counter
// and updates read_state in Cassandra.
export function sendReadReceipt(chatId, lastReadId) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !lastReadId) return;
  ws.send(JSON.stringify({ type: 'READ_RECEIPT', chatId, lastReadId }));
}

// Fanned out to the chat's other members as a TYPING event; never stored.
export function sendTyping(chatId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'TYPING', chatId }));
}

// WebRTC call signaling: CALL_OFFER | CALL_ANSWER | CALL_ICE | CALL_REJECT | CALL_END.
// The backend relays the frame to targetId's sessions; sdp/candidates travel in `payload`.
export function sendCallSignal(frame) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(frame));
  return true;
}
