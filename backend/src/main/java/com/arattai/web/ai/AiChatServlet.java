package com.arattai.web.ai;

import com.arattai.config.AppConfig;
import com.arattai.util.Json;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Ephemeral AI chat — no persistence, no Kafka. Passes full history for context. */
public class AiChatServlet extends HttpServlet {

    private static final String SYSTEM_PROMPT =
            "You are Arattai AI, a helpful and friendly assistant built into the Arattai chat platform. " +
            "Keep your responses concise and conversational.";

    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse res) {
        cors(res);
        res.setStatus(204);
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        cors(res);

        Map<?, ?> body;
        try {
            body = Json.read(req.getInputStream(), Map.class);
        } catch (Exception e) {
            Servlets.error(res, 400, "Invalid JSON");
            return;
        }

        Object msgsObj = body.get("messages");
        if (!(msgsObj instanceof List<?> rawList) || rawList.isEmpty()) {
            Servlets.error(res, 400, "messages array is required");
            return;
        }

        List<Map<String, String>> history = new ArrayList<>();
        history.add(Map.of("role", "system", "content", SYSTEM_PROMPT));

        for (Object item : rawList) {
            if (!(item instanceof Map<?, ?> m)) continue;
            Object role    = m.get("role");
            Object content = m.get("content");
            if (role == null || content == null) continue;
            String r = role.toString();
            if (!r.equals("user") && !r.equals("assistant")) continue;
            history.add(Map.of("role", r, "content", content.toString()));
        }

        if (history.size() < 2) { // only system prompt, no real messages
            Servlets.error(res, 400, "No valid messages provided");
            return;
        }

        try {
            String reply = AppConfig.get().getAiProvider().complete(history);
            Servlets.ok(res, Map.of("reply", reply));
        } catch (Exception e) {
            Servlets.error(res, 500, "AI error: " + e.getMessage());
        }
    }

    private void cors(HttpServletResponse res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
}
