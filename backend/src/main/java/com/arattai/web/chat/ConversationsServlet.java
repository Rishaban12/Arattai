package com.arattai.web.chat;

import com.arattai.config.AppConfig;
import com.arattai.dto.chat.ConversationResponse;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * GET    /api/conversations           — the caller's inbox (live unread from Redis)
 * DELETE /api/conversations/{chatId}  — remove a chat from the caller's inbox
 */
public class ConversationsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        long userId = Servlets.userId(req);
        try {
            List<ConversationResponse> conversations =
                    AppConfig.get().getConversationDao().getConversations(userId);

            // Live unread counters live in Redis, not Cassandra (design doc §4.2)
            for (ConversationResponse c : conversations) {
                String v = AppConfig.get().getRedisClient().get("unread:" + userId + ":" + c.chatId);
                c.unreadCount = v != null ? Integer.parseInt(v) : 0;
            }
            Servlets.ok(res, conversations);
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        long userId = Servlets.userId(req);
        String path = req.getPathInfo();
        if (path == null || path.length() <= 1) {
            Servlets.error(res, 400, "chatId required");
            return;
        }
        String chatId = URLDecoder.decode(path.substring(1), StandardCharsets.UTF_8);

        try {
            AppConfig.get().getConversationDao().delete(userId, chatId);
            // Clear any leftover unread counter for this chat
            AppConfig.get().getRedisClient().del("unread:" + userId + ":" + chatId);
            Servlets.ok(res, Map.of("message", "Conversation deleted"));
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
