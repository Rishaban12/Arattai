package com.arattai.service;

import com.arattai.cache.RedisClient;
import com.arattai.config.AppConfig;
import com.arattai.realtime.FanoutService;
import com.arattai.util.Json;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

public final class PresenceService {

    private PresenceService() {}

    private static final Logger log             = LoggerFactory.getLogger(PresenceService.class);
    private static final long   PRESENCE_TTL    = 60;  // seconds — refreshed by heartbeat
    private static final long   TYPING_TTL      = 5;

    public static void markOnline(long userId) {
        redis().setex("presence:" + userId, PRESENCE_TTL, "1");
        broadcastPresence(userId, true);
    }

    public static void heartbeat(long userId) {
        redis().expire("presence:" + userId, PRESENCE_TTL);
    }

    public static void markOffline(long userId) {
        redis().del("presence:" + userId);
        broadcastPresence(userId, false);
    }

    public static boolean isOnline(long userId) {
        return redis().exists("presence:" + userId);
    }

    public static void typing(String chatId, long senderId) {
        redis().setex("typing:" + chatId + ":" + senderId, TYPING_TTL, "1");
        List<Long> members = resolveChatMembers(chatId, senderId);
        String payload = Json.write(Map.of(
                "type",     "TYPING",
                "chatId",   chatId,
                "senderId", senderId));
        FanoutService.deliver(members, payload, redis());
    }

    public static List<Long> resolveChatMembers(String chatId, long excludeUserId) {
        if (chatId.startsWith("dm:")) {
            String[] parts = chatId.split(":");
            long a = Long.parseLong(parts[1]);
            long b = Long.parseLong(parts[2]);
            return (a == excludeUserId) ? List.of(b) : List.of(a);
        }
        if (chatId.startsWith("group:")) {
            try {
                long groupId = Long.parseLong(chatId.split(":")[1]);
                List<Long> members = AppConfig.get().getGroupDao().getMemberIds(groupId);
                members.remove(excludeUserId);
                return members;
            } catch (Exception e) {
                log.error("resolveChatMembers error", e);
            }
        }
        if (chatId.startsWith("subgroup:")) {
            try {
                long subGroupId = Long.parseLong(chatId.split(":")[1]);
                List<Long> members = AppConfig.get().getGroupDao().getSubGroupMemberIds(subGroupId);
                members.remove(excludeUserId);
                return members;
            } catch (Exception e) {
                log.error("resolveChatMembers error", e);
            }
        }
        return List.of();
    }

    private static void broadcastPresence(long userId, boolean online) {
        // Everyone is a contact of everyone in this app, so notify all other
        // users; only the ones actually online receive it through the fan-out.
        String payload = Json.write(Map.of(
                "type",   "PRESENCE",
                "userId", userId,
                "online", online));
        try {
            List<Long> recipients = AppConfig.get().getUserDao().listAllExcept(userId)
                    .stream().map(u -> u.id).toList();
            FanoutService.deliver(recipients, payload, redis());
        } catch (Exception e) {
            log.error("broadcastPresence error", e);
        }
    }

    private static RedisClient redis() {
        return AppConfig.get().getRedisClient();
    }
}
