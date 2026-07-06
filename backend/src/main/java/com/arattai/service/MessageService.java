package com.arattai.service;

import com.arattai.config.AppConfig;
import com.arattai.dto.chat.MessageResponse;
import com.arattai.messaging.KafkaEvent;
import com.arattai.messaging.KafkaProducerService;
import com.arattai.realtime.FanoutService;
import com.arattai.util.Json;
import com.arattai.util.TimeUUID;
import com.arattai.ws.Frame;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class MessageService {

    private MessageService() {}

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    public static void handleSend(Session session, Frame frame) {
        AppConfig cfg = AppConfig.get();
        long senderId = (long) session.getUserProperties().get("userId");

        try {
            // 1. Dedup check
            UUID existingId = null;
            boolean isNew = cfg.getMessageDao().insertDedup(frame.chatId, frame.clientMsgId, null);
            if (!isNew) {
                existingId = cfg.getMessageDao().getDedupMessageId(frame.chatId, frame.clientMsgId);
                sendAck(session, frame.clientMsgId, existingId, false);
                return;
            }

            // 2. Assign server-side message id
            UUID messageId = TimeUUID.generate();

            // 3. Re-insert dedup with real messageId
            cfg.getMessageDao().insertDedup(frame.chatId, frame.clientMsgId, messageId);

            // 4. ACK to sender
            sendAck(session, frame.clientMsgId, messageId, true);

            // 5. Resolve chat members for fan-out
            List<Long> recipients = PresenceService.resolveChatMembers(frame.chatId, senderId);

            // 6. Fan-out to all online recipients via Redis Pub/Sub
            fanOutMessage(frame.chatId, messageId, senderId, frame.content, frame.mediaUrl, recipients, cfg);

            // 7. Async Kafka publish for persistence, inbox, notify, AI
            KafkaEvent event = buildEvent(frame.chatId, messageId, senderId, frame.content, frame.mediaUrl);
            cfg.getKafkaProducer().send(KafkaProducerService.TOPIC_MESSAGES, frame.chatId, event);

        } catch (Exception e) {
            log.error("handleSend error", e);
        }
    }

    public static void markRead(String chatId, long userId, UUID lastReadId) {
        try {
            AppConfig.get().getReadStateDao().markRead(chatId, userId, lastReadId);
            // Clear unread counter in Redis
            AppConfig.get().getRedisClient().del("unread:" + userId + ":" + chatId);
        } catch (Exception e) {
            log.error("markRead error", e);
        }
    }

    public static void fanOutMessage(String chatId, UUID messageId, long senderId,
                                     String content, String mediaUrl,
                                     List<Long> recipients, AppConfig cfg) {
        MessageResponse msg = new MessageResponse();
        msg.messageId = messageId;
        msg.chatId    = chatId;
        msg.senderId  = senderId;
        msg.content   = content;
        msg.mediaUrl  = mediaUrl;
        msg.createdAt = Instant.now();

        String outbound = Json.write(Map.of("type", "MESSAGE", "data", msg));
        FanoutService.deliver(recipients, outbound, cfg.getRedisClient());
    }

    private static void sendAck(Session session, String clientMsgId, UUID messageId, boolean isNew) {
        try {
            String ack = Json.write(Map.of(
                    "type",        "ACK",
                    "clientMsgId", clientMsgId,
                    "messageId",   messageId.toString(),
                    "new",         isNew));
            session.getBasicRemote().sendText(ack);
        } catch (IOException e) {
            log.warn("ACK send failed", e);
        }
    }

    private static KafkaEvent buildEvent(String chatId, UUID messageId, long senderId,
                                         String content, String mediaUrl) {
        KafkaEvent e = new KafkaEvent();
        e.type      = "NEW_MESSAGE";
        e.chatId    = chatId;
        e.messageId = messageId;
        e.senderId  = senderId;
        e.content   = content;
        e.mediaUrl  = mediaUrl;
        e.timestamp = Instant.now();
        return e;
    }
}
