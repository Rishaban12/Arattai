import React, { useState, useRef, useEffect, useCallback } from 'react';
import Avatar from './Avatar';
import { sendCallSignal } from '../lib/socket';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const RING_TIMEOUT_MS = 30000;

// status: idle | outgoing (dialing) | incoming (ringing) | active
export default function CallOverlay({ me, contacts = [], callEvt, outgoing, onOutgoingConsumed }) {
  const [call, setCall] = useState(null); // { status, callId, peerId, peerName, media }
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState(null); // transient "Call declined" style banner

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);  // stored so we can re-attach after remount
  const pendingIceRef = useRef([]);      // remote candidates before remote description is set
  const remoteDescSetRef = useRef(false);
  const offerRef = useRef(null);         // incoming offer SDP, held until user accepts
  const callRef = useRef(null);          // mirror of `call` for use inside socket handlers
  const ringTimerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const selfPreviewRef = useRef(null);

  callRef.current = call;

  const peerName = useCallback(id => {
    const c = contacts.find(u => (u.userId ?? u.id) === id);
    return c?.name || `User ${id}`;
  }, [contacts]);

  const teardown = useCallback((message) => {
    clearTimeout(ringTimerRef.current);
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
    remoteDescSetRef.current = false;
    offerRef.current = null;
    setCall(null);
    setMuted(false);
    setCameraOff(false);
    setElapsed(0);
    if (message) {
      setNotice(message);
      setTimeout(() => setNotice(null), 3000);
    }
  }, []);

  function createPeerConnection(peerId, callId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = e => {
      if (e.candidate) {
        sendCallSignal({ type: 'CALL_ICE', targetId: peerId, callId, payload: JSON.stringify(e.candidate) });
      }
    };
    pc.ontrack = e => {
      const stream = (e.streams && e.streams[0]) ? e.streams[0] : (() => {
        const s = remoteStreamRef.current instanceof MediaStream
          ? remoteStreamRef.current : new MediaStream();
        s.addTrack(e.track);
        return s;
      })();
      remoteStreamRef.current = stream;
      const isVideoCall = callRef.current?.media === 'video';
      // Video call: video element carries both video + audio tracks
      if (isVideoCall) {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      } else {
        // Audio call: dedicated audio element
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') teardown('Call connection lost');
    };
    pcRef.current = pc;
    return pc;
  }

  function attachLocalVideo(stream) {
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
  }

  async function getMedia(media) {
    if (media !== 'video') {
      return { stream: await navigator.mediaDevices.getUserMedia({ audio: true, video: false }), hasVideo: false };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      return { stream, hasVideo: true };
    } catch {
      // Camera unavailable — continue as audio-only
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return { stream, hasVideo: false };
    }
  }

  async function flushPendingIce(pc) {
    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const cand of pending) {
      try { await pc.addIceCandidate(cand); } catch (e) { console.error('addIceCandidate failed', e); }
    }
  }

  // ── Outgoing call, triggered by the header buttons ──
  useEffect(() => {
    if (!outgoing) return;
    onOutgoingConsumed && onOutgoingConsumed();
    if (callRef.current) return; // already in a call
    startOutgoing(outgoing);
  }, [outgoing]); // eslint-disable-line

  async function startOutgoing({ targetId, name, media }) {
    const callId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `call${Date.now()}`;
    let stream, hasVideo;
    try {
      ({ stream, hasVideo } = await getMedia(media));
    } catch (e) {
      setNotice('Microphone access denied');
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    const actualMedia = (media === 'video' && hasVideo) ? 'video' : 'audio';
    if (media === 'video' && !hasVideo) {
      setNotice('Camera unavailable — calling with audio only');
      setTimeout(() => setNotice(null), 3000);
    }
    localStreamRef.current = stream;
    const pc = createPeerConnection(targetId, callId);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    setCall({ status: 'outgoing', callId, peerId: targetId, peerName: name, media: actualMedia });
    setTimeout(() => attachLocalVideo(stream), 0); // after render, set local preview

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sent = sendCallSignal({
      type: 'CALL_OFFER',
      targetId,
      callId,
      media: actualMedia,   // use actualMedia so receiver knows if it's really video
      payload: JSON.stringify(pc.localDescription),
    });
    if (!sent) {
      teardown('Not connected — call failed');
      return;
    }
    ringTimerRef.current = setTimeout(() => {
      sendCallSignal({ type: 'CALL_END', targetId, callId });
      teardown('No answer');
    }, RING_TIMEOUT_MS);
  }

  // ── Signaling events arriving over the WebSocket ──
  useEffect(() => {
    if (!callEvt) return;
    handleSignal(callEvt);
  }, [callEvt]); // eslint-disable-line

  async function handleSignal(evt) {
    const cur = callRef.current;
    switch (evt.type) {
      case 'CALL_OFFER': {
        if (cur) {
          // Busy on another call — auto-decline this one
          if (evt.callId !== cur.callId) {
            sendCallSignal({ type: 'CALL_REJECT', targetId: evt.senderId, callId: evt.callId });
          }
          return;
        }
        offerRef.current = evt.payload;
        setCall({
          status: 'incoming',
          callId: evt.callId,
          peerId: evt.senderId,
          peerName: peerName(evt.senderId),
          media: evt.media === 'video' ? 'video' : 'audio',
        });
        clearTimeout(ringTimerRef.current);
        ringTimerRef.current = setTimeout(() => teardown('Missed call'), RING_TIMEOUT_MS);
        return;
      }
      case 'CALL_ANSWER': {
        if (!cur || cur.callId !== evt.callId || !pcRef.current) return;
        clearTimeout(ringTimerRef.current);
        try {
          await pcRef.current.setRemoteDescription(JSON.parse(evt.payload));
          remoteDescSetRef.current = true;
          await flushPendingIce(pcRef.current);
          setCall(c => c && { ...c, status: 'active' });
        } catch (e) {
          console.error('setRemoteDescription(answer) failed', e);
          sendCallSignal({ type: 'CALL_END', targetId: cur.peerId, callId: cur.callId });
          teardown('Call failed');
        }
        return;
      }
      case 'CALL_ICE': {
        if (!cur || cur.callId !== evt.callId) return;
        let cand;
        try { cand = JSON.parse(evt.payload); } catch { return; }
        if (pcRef.current && remoteDescSetRef.current) {
          try { await pcRef.current.addIceCandidate(cand); } catch (e) { console.error('addIceCandidate failed', e); }
        } else {
          pendingIceRef.current.push(cand);
        }
        return;
      }
      case 'CALL_REJECT': {
        if (!cur || cur.callId !== evt.callId) return;
        teardown('Call declined');
        return;
      }
      case 'CALL_END': {
        if (!cur || cur.callId !== evt.callId) return;
        teardown(cur.status === 'incoming' ? 'Missed call' : 'Call ended');
        return;
      }
      case 'CALL_UNAVAILABLE': {
        if (!cur || cur.callId !== evt.callId) return;
        teardown(`${cur.peerName} is offline`);
        return;
      }
      default:
    }
  }

  async function accept() {
    const cur = callRef.current;
    if (!cur || cur.status !== 'incoming' || !offerRef.current) return;
    clearTimeout(ringTimerRef.current);
    let stream, hasVideo;
    try {
      ({ stream, hasVideo } = await getMedia(cur.media));
    } catch (e) {
      sendCallSignal({ type: 'CALL_REJECT', targetId: cur.peerId, callId: cur.callId });
      teardown('Microphone access denied');
      return;
    }
    if (cur.media === 'video' && !hasVideo) {
      setNotice('Camera unavailable — joining with audio only');
      setTimeout(() => setNotice(null), 4000);
    }
    localStreamRef.current = stream;
    const pc = createPeerConnection(cur.peerId, cur.callId);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    setTimeout(() => attachLocalVideo(stream), 0); // after render, set local preview
    try {
      await pc.setRemoteDescription(JSON.parse(offerRef.current));
      remoteDescSetRef.current = true;
      await flushPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendCallSignal({
        type: 'CALL_ANSWER',
        targetId: cur.peerId,
        callId: cur.callId,
        payload: JSON.stringify(pc.localDescription),
      });
      setCall(c => c && { ...c, status: 'active' });
    } catch (e) {
      console.error('accept failed', e);
      sendCallSignal({ type: 'CALL_END', targetId: cur.peerId, callId: cur.callId });
      teardown('Call failed');
    }
  }

  function decline() {
    const cur = callRef.current;
    if (!cur) return;
    sendCallSignal({ type: 'CALL_REJECT', targetId: cur.peerId, callId: cur.callId });
    teardown();
  }

  function hangup() {
    const cur = callRef.current;
    if (!cur) return;
    sendCallSignal({ type: 'CALL_END', targetId: cur.peerId, callId: cur.callId });
    teardown();
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOff;
    stream.getVideoTracks().forEach(t => { t.enabled = !next; });
    setCameraOff(next);
  }

  // Call duration ticker
  useEffect(() => {
    if (call?.status !== 'active') return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  // Re-attach streams after render (elements may remount when cameraOff or status toggles)
  useEffect(() => {
    if (!call) return;
    const isVideoCall = call.media === 'video';
    // setTimeout 0 lets React finish mounting the (conditionally rendered) elements first
    setTimeout(() => {
      if (localStreamRef.current) {
        if (localVideoRef.current)  localVideoRef.current.srcObject  = localStreamRef.current;
        if (selfPreviewRef.current) selfPreviewRef.current.srcObject = localStreamRef.current;
      }
      if (remoteStreamRef.current) {
        if (isVideoCall && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        } else if (!isVideoCall && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStreamRef.current;
        }
      }
    }, 0);
  }, [call, cameraOff]);

  // Clean up everything on unmount (e.g. sign-out)
  useEffect(() => () => teardown(), [teardown]);

  const fmtDuration = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!call && !notice) return null;

  if (!call) {
    return <div className="call-notice">{notice}</div>;
  }

  const isVideo = call.media === 'video';
  const statusLabel =
    call.status === 'outgoing' ? 'Calling…'
    : call.status === 'incoming' ? (isVideo ? 'Incoming video call' : 'Incoming voice call')
    : fmtDuration(elapsed);

  return (
    <div className="call-overlay">
      <div className={`call-window${isVideo && call.status === 'active' ? ' call-window-video' : ''}`}>

        {/* ── Remote video always in DOM so the ref never breaks ── */}
        <div className="call-video-stage" style={{ display: isVideo && call.status === 'active' ? 'flex' : 'none' }}>
          <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />

          {/* Local PiP — avatar when camera off, video when on */}
          <div className="call-local-pip">
            {cameraOff
              ? <div className="call-pip-avatar"><Avatar name={me?.name || '?'} size={48} /></div>
              : <video ref={localVideoRef} className="call-pip-video" autoPlay playsInline muted />
            }
            {muted && <div className="call-pip-muted-badge"><CallMicIcon off /></div>}
          </div>

          {/* Top bar — peer name + timer */}
          <div className="call-video-topbar">
            <span className="call-peer-name">{call.peerName}</span>
            <span className="call-status">{statusLabel}</span>
          </div>

          {/* Bottom controls */}
          <div className="call-controls call-controls-video">
            <button className={`call-btn call-btn-ctl${muted ? ' call-btn-ctl-off' : ''}`}
              onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              <CallMicIcon off={muted} />
            </button>
            <button className={`call-btn call-btn-ctl${cameraOff ? ' call-btn-ctl-off' : ''}`}
              onClick={toggleCamera} title={cameraOff ? 'Turn camera on' : 'Turn camera off'}>
              <CallCamIcon off={cameraOff} />
            </button>
            <button className="call-btn call-btn-end" onClick={hangup} title="Hang up">
              <HangupIcon />
            </button>
          </div>
        </div>

        {/* Audio always mounted — carries remote audio for audio calls and pre-active video */}
        <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

        {/* ── Ringing / incoming / audio-active UI ── */}
        {(!isVideo || call.status !== 'active') && (
          <>
            {/* Local self-preview during video ringing */}
            {isVideo && (
              <video ref={selfPreviewRef} className="call-self-preview" autoPlay playsInline muted />
            )}

            <div className="call-peer-info">
              <div className={call.status !== 'active' ? 'call-avatar-ring' : ''}>
                <Avatar name={call.peerName} size={86} />
              </div>
              <div className="call-peer-name">{call.peerName}</div>
              <div className="call-status">{statusLabel}</div>
            </div>

            <div className="call-controls">
              {call.status === 'incoming' ? (
                <>
                  <button className="call-btn call-btn-accept" onClick={accept} title="Accept">
                    <CallPhoneIcon />
                  </button>
                  <button className="call-btn call-btn-end" onClick={decline} title="Decline">
                    <HangupIcon />
                  </button>
                </>
              ) : (
                <>
                  <button className={`call-btn call-btn-ctl${muted ? ' call-btn-ctl-off' : ''}`}
                    onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                    <CallMicIcon off={muted} />
                  </button>
                  <button className="call-btn call-btn-end" onClick={hangup} title="Hang up">
                    <HangupIcon />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CallPhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  );
}

function HangupIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
    </svg>
  );
}

function CallMicIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
      {off && <line x1="3" y1="3" x2="21" y2="21" stroke="#ef4444" strokeWidth="2.4"/>}
    </svg>
  );
}

function CallCamIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
      {off && <line x1="3" y1="3" x2="21" y2="21" stroke="#ef4444" strokeWidth="2.4"/>}
    </svg>
  );
}
