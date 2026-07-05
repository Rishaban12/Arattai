package com.arattai.realtime;

import jakarta.websocket.Session;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class LocalSessionRegistry {

    private LocalSessionRegistry() {}

    private static final ConcurrentHashMap<Long, Set<Session>> sessions = new ConcurrentHashMap<>();

    public static void add(long userId, Session session) {
        sessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public static void remove(long userId, Session session) {
        Set<Session> userSessions = sessions.get(userId);
        if (userSessions != null) {
            userSessions.remove(session);
            if (userSessions.isEmpty()) sessions.remove(userId);
        }
    }

    public static Set<Session> get(long userId) {
        return sessions.getOrDefault(userId, Collections.emptySet());
    }

    public static boolean isOnline(long userId) {
        Set<Session> s = sessions.get(userId);
        return s != null && !s.isEmpty();
    }
}