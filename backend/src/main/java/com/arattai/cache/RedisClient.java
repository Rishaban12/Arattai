package com.arattai.cache;

import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.pubsub.RedisPubSubListener;
import io.lettuce.core.pubsub.StatefulRedisPubSubConnection;

import java.util.function.Consumer;

public class RedisClient implements AutoCloseable {

    private final io.lettuce.core.RedisClient          client;
    private final StatefulRedisConnection<String, String> conn;
    private StatefulRedisPubSubConnection<String, String> pubSubConn;

    public RedisClient(String redisUrl) {
        client = io.lettuce.core.RedisClient.create(RedisURI.create(redisUrl));
        conn   = client.connect();
    }

    // ── Generic commands ────────────────────────────────────────────────────

    public RedisCommands<String, String> sync() {
        return conn.sync();
    }

    public void set(String key, String value) {
        conn.sync().set(key, value);
    }

    public void setex(String key, long ttlSeconds, String value) {
        conn.sync().setex(key, ttlSeconds, value);
    }

    public String get(String key) {
        return conn.sync().get(key);
    }

    public void del(String key) {
        conn.sync().del(key);
    }

    public boolean exists(String key) {
        return conn.sync().exists(key) > 0;
    }

    public void expire(String key, long ttlSeconds) {
        conn.sync().expire(key, ttlSeconds);
    }

    public Long incr(String key) {
        return conn.sync().incr(key);
    }

    public void publish(String channel, String message) {
        conn.sync().publish(channel, message);
    }

    // ── List commands (hot cache of recent messages) ────────────────────────

    /** Prepends only if the key already exists — returns new length, 0 if key absent. */
    public long lpushx(String key, String value) {
        return conn.sync().lpushx(key, value);
    }

    public void rpush(String key, String... values) {
        conn.sync().rpush(key, values);
    }

    public void ltrim(String key, long start, long stop) {
        conn.sync().ltrim(key, start, stop);
    }

    public java.util.List<String> lrange(String key, long start, long stop) {
        return conn.sync().lrange(key, start, stop);
    }

    // ── Pub/Sub ─────────────────────────────────────────────────────────────

    public void subscribe(String channel, Consumer<String> onMessage) {
        pubSubConn = client.connectPubSub();
        pubSubConn.addListener(new RedisPubSubListener<>() {
            @Override public void message(String ch, String msg) {
                if (ch.equals(channel)) onMessage.accept(msg);
            }
            @Override public void message(String pattern, String channel, String msg) {}
            @Override public void subscribed(String ch, long count) {}
            @Override public void psubscribed(String pattern, long count) {}
            @Override public void unsubscribed(String ch, long count) {}
            @Override public void punsubscribed(String pattern, long count) {}
        });
        pubSubConn.sync().subscribe(channel);
    }

    @Override
    public void close() {
        if (pubSubConn != null) pubSubConn.close();
        conn.close();
        client.shutdown();
    }
}