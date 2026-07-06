package com.arattai.web.auth;

import com.arattai.auth.CookieHelper;
import com.arattai.config.AppConfig;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

public class LogoutServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        // Logout is in PUBLIC_PATHS so AuthFilter does not run.
        // Extract userId from the refresh token cookie to revoke the Redis entry.
        String refreshCookie = CookieHelper.readCookie(req, CookieHelper.REFRESH_COOKIE);
        if (refreshCookie != null && !refreshCookie.isBlank()) {
            try {
                String[] parts = refreshCookie.split(":", 2);
                if (parts.length == 2) {
                    long   userId = Long.parseLong(parts[0]);
                    String uuid   = parts[1];
                    AppConfig.get().getRedisClient().del("refresh:" + userId + ":" + uuid);
                }
            } catch (Exception ignored) {
                // Best-effort — always clear cookies and return 200
            }
        }

        CookieHelper.clearAuth(res);
        Servlets.ok(res, Map.of("message", "Logged out"));
    }
}
