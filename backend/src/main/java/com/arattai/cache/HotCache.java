package com.arattai.cache;

import java.util.List;

/**
 * Hot cache of the most recent messages per chat (design doc §4.1).
 *
 * Key    : chat:recent:{chatId}
 * Type   : Redis LIST of MessageResponse JSON, newest first
 * Size   : last 50 messages (LTRIM)
 * TTL    : 30 minutes, refreshed on every write
 *
 * PersistConsumer prepends each new message with LPUSHX so an expired (cold)
 * chat stays cold — the cache is rebuilt from Cassandra on the next read.
 */
public final class HotCache {

    public static final int  SIZE        = 50;
    public static final long TTL_SECONDS = 30 * 60;

    private HotCache() {}

    public static String key(String chatId) {
        return "chat:recent:" + chatId;
    }

    /** Prepend a new message if the chat is already cached; no-op for cold chats. */
    public static void pushIfCached(RedisClient redis, String chatId, String messageJson) {
        String k = key(chatId);
        if (redis.lpushx(k, messageJson) > 0) {
            redis.ltrim(k, 0, SIZE - 1);
            redis.expire(k, TTL_SECONDS);
        }
    }

    /** First `count` cached messages (newest first). Empty list = cache miss. */
    public static List<String> read(RedisClient redis, String chatId, int count) {
        return redis.lrange(key(chatId), 0, count - 1);
    }

    /** Rebuild the cache from a fresh Cassandra page (newest-first JSON). */
    public static void populate(RedisClient redis, String chatId, List<String> newestFirstJson) {
        String k = key(chatId);
        redis.del(k);
        if (newestFirstJson.isEmpty()) return;
        redis.rpush(k, newestFirstJson.toArray(new String[0]));
        redis.ltrim(k, 0, SIZE - 1);
        redis.expire(k, TTL_SECONDS);
    }
}
