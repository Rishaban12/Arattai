package com.arattai.ws;

import com.arattai.auth.WsHandshakeAuth;
import com.arattai.realtime.LocalSessionRegistry;
import com.arattai.service.MessageService;
import com.arattai.service.PresenceService;
import com.arattai.util.Json;
import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@ServerEndpoint(value = "/ws", configurator = WsHandshakeAuth.class)
public class ChatSocket {

    private static final Logger log = LoggerFactory.getLogger(ChatSocket.class);

    @OnOpen
    public void onOpen(Session session) {
        Long userId = (Long) session.getUserProperties().get("userId");
        if (userId == null) {
            // Handshake auth failed — reject connection
            try {
                session.close(new CloseReason(CloseReason.CloseCodes.VIOLATED_POLICY, "Unauthorized"));
            } catch (IOException e) {
                log.warn("Could not close unauthorized WS session", e);
            }
            return;
        }
        LocalSessionRegistry.add(userId, session);
        PresenceService.markOnline(userId);
        log.debug("WS opened uid={} sessionId={}", userId, session.getId());
    }

    @OnMessage
    public void onMessage(String json, Session session) {
        Long userId = (Long) session.getUserProperties().get("userId");
        if (userId == null) return;

        Frame frame;
        try {
            frame = Json.read(json, Frame.class);
        } catch (Exception e) {
            log.warn("Bad WS frame from uid={}: {}", userId, e.getMessage());
            return;
        }

        // Overwrite senderId from the authenticated session — never trust client-supplied id
        frame.senderId = userId;

        switch (frame.type) {
            case "SEND_MESSAGE" -> MessageService.handleSend(session, frame);
            case "TYPING"       -> PresenceService.typing(frame.chatId, userId);
            case "READ_RECEIPT" -> MessageService.markRead(frame.chatId, userId, frame.lastReadId);
            case "PING"         -> {
                PresenceService.heartbeat(userId);
                sendPong(session);
            }
            default -> log.warn("Unknown frame type '{}' from uid={}", frame.type, userId);
        }
    }

    @OnClose
    public void onClose(Session session, CloseReason reason) {
        Long userId = (Long) session.getUserProperties().get("userId");
        if (userId == null) return;
        LocalSessionRegistry.remove(userId, session);
        if (!LocalSessionRegistry.isOnline(userId)) {
            PresenceService.markOffline(userId);
        }
        log.debug("WS closed uid={} reason={}", userId, reason.getCloseCode());
    }

    @OnError
    public void onError(Session session, Throwable error) {
        Long userId = (Long) session.getUserProperties().get("userId");
        log.error("WS error uid={}", userId, error);
    }

    private void sendPong(Session session) {
        try {
            session.getBasicRemote().sendText(Json.write(Map.of("type", "PONG")));
        } catch (IOException e) {
            log.warn("PONG send failed", e);
        }
    }
}
