package com.arattai.messaging;

import com.arattai.cache.HotCache;
import com.arattai.config.AppConfig;
import com.arattai.dto.chat.MessageResponse;
import com.arattai.util.Json;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Properties;

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
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG,  System.getenv().getOrDefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"));
        props.put(ConsumerConfig.GROUP_ID_CONFIG,           groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG,   StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG,  "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");
        return new KafkaConsumer<>(props);
    }
}
