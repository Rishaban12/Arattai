package com.arattai.messaging;

import com.arattai.config.AppConfig;
import com.arattai.util.Json;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.List;

/** Updates conversations_by_user inbox entries and bumps Redis unread counters. */
public class InboxConsumer implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(InboxConsumer.class);

    @Override
    public void run() {
        try (KafkaConsumer<String, String> consumer = buildConsumer("arattai-inbox")) {
            consumer.subscribe(List.of(KafkaProducerService.TOPIC_MESSAGES));
            while (!Thread.currentThread().isInterrupted()) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> record : records) {
                    try {
                        KafkaEvent event = Json.read(record.value(), KafkaEvent.class);
                        processInbox(event);
                    } catch (Exception e) {
                        log.error("InboxConsumer error", e);
                    }
                }
            }
        }
    }

    private void processInbox(KafkaEvent event) throws Exception {
        // AI chats are ephemeral — no inbox rows, no unread counters
        if (event.chatId.startsWith("ai:") || "arattai-ai".equals(event.chatId)) return;

        AppConfig cfg = AppConfig.get();

        // Update the sender's conversation row (no unread increment for sender)
        cfg.getConversationDao().upsert(
                event.senderId, event.chatId, event.chatId,
                event.content, event.timestamp, 0);

        // Determine recipients from chat participants
        // For DMs, derive from chatId (dm:{userId1}:{userId2})
        List<Long> recipients = resolveChatMembers(event.chatId, event.senderId);
        for (long recipientId : recipients) {
            cfg.getConversationDao().upsert(
                    recipientId, event.chatId, event.chatId,
                    event.content, event.timestamp, 0);

            // Increment Redis unread counter
            String unreadKey = "unread:" + recipientId + ":" + event.chatId;
            cfg.getRedisClient().incr(unreadKey);
        }
    }

    private List<Long> resolveChatMembers(String chatId, long senderId) throws Exception {
        // DM chat ids are formatted as "dm:{uid1}:{uid2}"
        if (chatId.startsWith("dm:")) {
            String[] parts = chatId.split(":");
            long a = Long.parseLong(parts[1]);
            long b = Long.parseLong(parts[2]);
            return (a == senderId) ? List.of(b) : List.of(a);
        }
        // Group chat ids are "group:{groupId}"
        if (chatId.startsWith("group:")) {
            long groupId = Long.parseLong(chatId.split(":")[1]);
            List<Long> members = AppConfig.get().getGroupDao().getMemberIds(groupId);
            members.remove(senderId);
            return members;
        }
        // Subgroup chat ids are "subgroup:{subGroupId}"
        if (chatId.startsWith("subgroup:")) {
            long subGroupId = Long.parseLong(chatId.split(":")[1]);
            List<Long> members = AppConfig.get().getGroupDao().getSubGroupMemberIds(subGroupId);
            members.remove(senderId);
            return members;
        }
        return List.of();
    }

    private KafkaConsumer<String, String> buildConsumer(String groupId) {
        return new KafkaConsumer<>(KafkaConfig.consumer(groupId));
    }
}
