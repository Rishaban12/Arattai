package com.arattai.realtime;

import com.arattai.cache.RedisClient;
import com.arattai.util.Json;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;

public final class FanoutService {

    private FanoutService() {}

    private static final Logger log     = LoggerFactory.getLogger(FanoutService.class);
    private static final String CHANNEL = "chat-events";

    /**
     * Deliver a payload to all instances by publishing on the Redis channel.
     * Every instance's subscriber picks it up and pushes to locally-connected sockets.
     */
    public static void deliver(List<Long> recipientIds, String payload, RedisClient redis) {
        FanoutMsg msg = new FanoutMsg(recipientIds, payload);
        redis.publish(CHANNEL, Json.write(msg));
    }

    /**
     * Start the subscriber on this instance. Called once at bootstrap.
     */
    public static void startSubscriber(RedisClient redis) {
        redis.subscribe(CHANNEL, raw -> {
            FanoutMsg fm = Json.read(raw, FanoutMsg.class);
            for (Long uid : fm.recipientIds) {
                for (Session s : LocalSessionRegistry.get(uid)) {
                    if (s.isOpen()) {
                        s.getAsyncRemote().sendText(fm.payload, result -> {
                            if (!result.isOK()) {
                                log.warn("WS send failed to uid={}: {}", uid, result.getException().getMessage());
                            }
                        });
                    }
                }
            }
        });
        log.info("FanoutService subscribed to Redis channel '{}'", CHANNEL);
    }
}
