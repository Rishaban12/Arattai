package com.arattai.service;

import com.arattai.config.AppConfig;
import com.arattai.realtime.FanoutService;
import com.arattai.util.Json;
import com.arattai.ws.Frame;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 1:1 call signaling relay. The server never inspects SDP/ICE payloads — it
 * forwards CALL_* frames between caller and callee over the same Redis
 * fan-out used for messages, so signaling works across instances.
 */
public final class CallService {

    private CallService() {}

    private static final Logger log = LoggerFactory.getLogger(CallService.class);

    public static void relay(Session senderSession, Frame frame) {
        long senderId = frame.senderId;
        if (frame.targetId <= 0 || frame.callId == null || frame.callId.isBlank()) {
            log.warn("Dropping malformed {} frame from uid={}", frame.type, senderId);
            return;
        }
        if (frame.targetId == senderId) return;

        // Ringing an offline user would just time out — tell the caller immediately.
        if ("CALL_OFFER".equals(frame.type) && !PresenceService.isOnline(frame.targetId)) {
            sendToSession(senderSession, Map.of(
                    "type",   "CALL_UNAVAILABLE",
                    "callId", frame.callId,
                    "senderId", frame.targetId));
            return;
        }

        Map<String, Object> out = new HashMap<>();
        out.put("type",     frame.type);
        out.put("callId",   frame.callId);
        out.put("senderId", senderId);
        if (frame.media   != null) out.put("media",   frame.media);
        if (frame.payload != null) out.put("payload", frame.payload);

        FanoutService.deliver(List.of(frame.targetId), Json.write(out),
                AppConfig.get().getRedisClient());
    }

    private static void sendToSession(Session session, Map<String, Object> payload) {
        try {
            session.getBasicRemote().sendText(Json.write(payload));
        } catch (IOException e) {
            log.warn("Call signal send failed", e);
        }
    }
}
