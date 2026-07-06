package com.arattai.web.chat;

import com.arattai.cache.HotCache;
import com.arattai.config.AppConfig;
import com.arattai.dto.chat.MessageResponse;
import com.arattai.util.Json;
import com.arattai.util.Servlets;
import com.arattai.util.TimeUUID;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * GET /api/chats/{chatId}/messages?before={messageId}&limit=30
 * Path format: /api/chats/{chatId}/messages
 */
public class MessageHistoryServlet extends HttpServlet {

    private static final int DEFAULT_LIMIT = 30;
    private static final int MAX_LIMIT     = 100;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        // Extract chatId from path: /api/chats/{chatId}/messages
        String pathInfo = req.getPathInfo();
        if (pathInfo == null || !pathInfo.contains("/")) {
            Servlets.error(res, 400, "Invalid path — expected /api/chats/{chatId}/messages");
            return;
        }
        String[] segments = pathInfo.split("/");
        // segments: ["", "{chatId}", "messages"]
        if (segments.length < 3) {
            Servlets.error(res, 400, "chatId required");
            return;
        }
        String chatId = segments[1];

        // Cursor: before={timeuuid}
        String beforeParam = req.getParameter("before");
        UUID beforeId = beforeParam != null
                ? TimeUUID.fromString(beforeParam)
                : Uuids.endOf(System.currentTimeMillis()); // latest first

        int limit = DEFAULT_LIMIT;
        String limitParam = req.getParameter("limit");
        if (limitParam != null) {
            try { limit = Math.min(Integer.parseInt(limitParam), MAX_LIMIT); }
            catch (NumberFormatException ignored) {}
        }

        try {
            AppConfig cfg = AppConfig.get();

            // First page (no cursor): serve from the Redis hot cache when possible
            if (beforeParam == null) {
                List<String> cached = HotCache.read(cfg.getRedisClient(), chatId, limit);
                // A list shorter than SIZE holds the whole chat; equal to SIZE it may
                // be truncated, so only trust it when it covers the requested limit.
                if (!cached.isEmpty() && (cached.size() >= limit || cached.size() < HotCache.SIZE)) {
                    res.setStatus(200);
                    res.setContentType("application/json");
                    res.getWriter().write("[" + String.join(",", cached) + "]");
                    return;
                }

                // Cache miss — read a full page from Cassandra and rebuild the cache
                List<MessageResponse> page = cfg.getMessageDao()
                        .getHistory(chatId, beforeId, Math.max(limit, HotCache.SIZE));
                HotCache.populate(cfg.getRedisClient(), chatId,
                        page.stream().map(Json::write).toList());
                Servlets.ok(res, page.subList(0, Math.min(limit, page.size())));
                return;
            }

            // Scroll-up (cursor) reads always come from Cassandra
            List<MessageResponse> messages =
                    cfg.getMessageDao().getHistory(chatId, beforeId, limit);
            Servlets.ok(res, messages);
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
