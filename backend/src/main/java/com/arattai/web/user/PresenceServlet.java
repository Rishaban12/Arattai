package com.arattai.web.user;

import com.arattai.service.PresenceService;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * GET /api/presence/{userId} — is this user online right now?
 * Backed by the presence:{userId} Redis key (60s TTL, heartbeat-refreshed).
 */
public class PresenceServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        String path = req.getPathInfo();
        if (path == null || path.length() <= 1) {
            Servlets.error(res, 400, "userId required");
            return;
        }
        try {
            long userId = Long.parseLong(path.substring(1));
            Servlets.ok(res, Map.of("userId", userId, "online", PresenceService.isOnline(userId)));
        } catch (NumberFormatException e) {
            Servlets.error(res, 400, "Invalid user id");
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
