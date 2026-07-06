package com.arattai.web.auth;

import com.arattai.auth.CookieHelper;
import com.arattai.auth.JwtService;
import com.arattai.cache.RedisClient;
import com.arattai.config.AppConfig;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

public class RefreshServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        String cookieValue = CookieHelper.readCookie(req, CookieHelper.REFRESH_COOKIE);
        if (cookieValue == null || cookieValue.isBlank()) {
            Servlets.error(res, 401, "No refresh token");
            return;
        }

        // Cookie format: "{userId}:{uuid}"
        String[] parts = cookieValue.split(":", 2);
        if (parts.length != 2) {
            Servlets.error(res, 401, "Invalid refresh token");
            return;
        }

        try {
            long        userId   = Long.parseLong(parts[0]);
            String      uuid     = parts[1];
            RedisClient redis    = AppConfig.get().getRedisClient();
            String      redisKey = "refresh:" + userId + ":" + uuid;

            if (!redis.exists(redisKey)) {
                CookieHelper.clearAuth(res);
                Servlets.error(res, 401, "Refresh token expired or invalid");
                return;
            }

            // Rotate: delete old token, issue new pair
            redis.del(redisKey);

            String newUuid    = UUID.randomUUID().toString();
            String newRefresh = userId + ":" + newUuid;
            redis.setex("refresh:" + userId + ":" + newUuid, CookieHelper.REFRESH_MAX_AGE, "1");

            String newAccess = JwtService.get().issueAccess(userId);
            CookieHelper.setAccessCookie(res, newAccess);
            CookieHelper.setRefreshCookie(res, newRefresh);

            Servlets.ok(res, Map.of("ok", true));

        } catch (NumberFormatException e) {
            Servlets.error(res, 401, "Invalid refresh token");
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
