package com.arattai.messaging;

import com.arattai.config.AppConfig;
import com.arattai.service.PresenceService;
import com.arattai.util.Json;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.List;
import java.util.Properties;

/**
 * Sends push notifications (FCM/APNs) to offline recipients.
 * Skips users who are currently online (connected via WebSocket).
 */
public class NotifyConsumer implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(NotifyConsumer.class);

    @Override
    public void run() {
        try (KafkaConsumer<String, String> consumer = buildConsumer("arattai-notify")) {
            consumer.subscribe(List.of(KafkaProducerService.TOPIC_MESSAGES));
            while (!Thread.currentThread().isInterrupted()) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> record : records) {
                    try {
                        KafkaEvent event = Json.read(record.value(), KafkaEvent.class);
                        sendPushNotifications(event);
                    } catch (Exception e) {
                        log.error("NotifyConsumer error", e);
                    }
                }
            }
        }
    }

    private void sendPushNotifications(KafkaEvent event) throws Exception {
        List<Long> recipients = resolveChatMembers(event.chatId, event.senderId);
        for (long uid : recipients) {
            // Design doc §4.2: the Redis presence key is the source of truth —
            // it covers every backend node, not just this JVM's sessions.
            if (PresenceService.isOnline(uid)) continue; // skip online users

            List<String> tokens = AppConfig.get().getGroupDao().getDeviceTokens(uid);
            if (tokens.isEmpty()) {
                log.debug("Push skipped: uid={} offline but has no device tokens", uid);
                continue;
            }
            for (String token : tokens) {
                // TODO: integrate FCM/APNs SDK — placeholder log
                log.info("Push → uid={} token={} chat={} msg={}", uid, token, event.chatId, event.content);
            }
        }
    }

    private List<Long> resolveChatMembers(String chatId, long senderId) throws Exception {
        if (chatId.startsWith("dm:")) {
            String[] parts = chatId.split(":");
            long a = Long.parseLong(parts[1]);
            long b = Long.parseLong(parts[2]);
            return (a == senderId) ? List.of(b) : List.of(a);
        }
        if (chatId.startsWith("group:")) {
            long groupId = Long.parseLong(chatId.split(":")[1]);
            List<Long> members = AppConfig.get().getGroupDao().getMemberIds(groupId);
            members.remove(senderId);
            return members;
        }
        if (chatId.startsWith("subgroup:")) {
            long subGroupId = Long.parseLong(chatId.split(":")[1]);
            List<Long> members = AppConfig.get().getGroupDao().getSubGroupMemberIds(subGroupId);
            members.remove(senderId);
            return members;
        }
        return List.of();
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
