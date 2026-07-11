package com.arattai.messaging;

import com.arattai.cache.HotCache;
import com.arattai.config.AppConfig;
import com.arattai.dto.chat.MessageResponse;
import com.arattai.util.Json;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Persists messages from chat.messages into Cassandra messages_by_chat. */
public class PersistConsumer implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(PersistConsumer.class);

    @Override
    public void run() {
        try (KafkaConsumer<String, String> consumer = buildConsumer("arattai-persist")) {
            consumer.subscribe(List.of(KafkaProducerService.TOPIC_MESSAGES));
            while (!Thread.currentThread().isInterrupted()) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> record : records) {
                    try {
                        KafkaEvent event = Json.read(record.value(), KafkaEvent.class);
                        // AI chats are ephemeral — never persisted
                        if (event.chatId.startsWith("ai:") || "arattai-ai".equals(event.chatId)) continue;
                        AppConfig.get().getMessageDao().insert(
                                event.chatId, event.messageId, event.senderId,
                                event.content, event.mediaUrl);

                        // Keep the Redis hot cache fresh (only for already-cached chats)
                        MessageResponse m = new MessageResponse();
                        m.messageId = event.messageId;
                        m.chatId    = event.chatId;
                        m.senderId  = event.senderId;
                        m.content   = event.content;
                        m.mediaUrl  = event.mediaUrl;
                        m.createdAt = Instant.ofEpochMilli(Uuids.unixTimestamp(event.messageId));
                        HotCache.pushIfCached(AppConfig.get().getRedisClient(),
                                event.chatId, Json.write(m));
                    } catch (Exception e) {
                        log.error("PersistConsumer error", e);
                    }
                }
            }
        }
    }

    private KafkaConsumer<String, String> buildConsumer(String groupId) {
        return new KafkaConsumer<>(KafkaConfig.consumer(groupId));
    }
}
