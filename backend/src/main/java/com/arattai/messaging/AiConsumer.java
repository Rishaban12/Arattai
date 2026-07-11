package com.arattai.messaging;

import com.arattai.config.AppConfig;
import com.arattai.service.MessageService;
import com.arattai.util.Json;
import com.arattai.util.TimeUUID;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Handles AI-powered chat messages — only active for chats with id prefix "ai:". */
public class AiConsumer implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(AiConsumer.class);

    private static final long AI_SENDER_ID = -1L; // virtual AI user

    @Override
    public void run() {
        try (KafkaConsumer<String, String> consumer = buildConsumer("arattai-ai")) {
            consumer.subscribe(List.of(KafkaProducerService.TOPIC_MESSAGES));
            while (!Thread.currentThread().isInterrupted()) {
                ConsumerRecords<String, String> records = consumer.poll(java.time.Duration.ofMillis(500));
                for (ConsumerRecord<String, String> record : records) {
                    try {
                        KafkaEvent event = Json.read(record.value(), KafkaEvent.class);
                        if (!event.chatId.startsWith("ai:")) continue;
                        handleAiRequest(event);
                    } catch (Exception e) {
                        log.error("AiConsumer error", e);
                    }
                }
            }
        }
    }

    private void handleAiRequest(KafkaEvent event) throws Exception {
        AppConfig cfg = AppConfig.get();
        String aiReply = cfg.getAiProvider().complete(
                List.of(Map.of("role", "user", "content", event.content)));

        UUID    aiMsgId    = TimeUUID.generate();
        Instant now        = Instant.now();

        // Fan-out AI reply to chat participants (not persisted — AI chat is ephemeral)
        KafkaEvent aiEvent = new KafkaEvent();
        aiEvent.type      = "NEW_MESSAGE";
        aiEvent.chatId    = event.chatId;
        aiEvent.messageId = aiMsgId;
        aiEvent.senderId  = AI_SENDER_ID;
        aiEvent.content   = aiReply;
        aiEvent.timestamp = now;

        MessageService.fanOutMessage(
                event.chatId, aiMsgId, AI_SENDER_ID, aiReply, null,
                List.of(event.senderId), cfg);
    }

    private KafkaConsumer<String, String> buildConsumer(String groupId) {
        return new KafkaConsumer<>(KafkaConfig.consumer(groupId));
    }
}
