package com.arattai.web.auth;

import com.arattai.auth.CookieHelper;
import com.arattai.auth.JwtService;
import com.arattai.config.AppConfig;
import com.arattai.dto.auth.LoginRequest;
import com.arattai.model.User;
import com.arattai.util.Hashing;
import com.arattai.util.Json;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class LoginServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        LoginRequest body;
        try {
            body = Json.read(req.getInputStream(), LoginRequest.class);
        } catch (Exception e) {
            Servlets.error(res, 400, "Invalid request body");
            return;
        }

        if (body.email == null || body.password == null) {
            Servlets.error(res, 400, "email and password are required");
            return;
        }

        try {
            Optional<User> found = AppConfig.get().getUserDao().findByEmail(body.email);
            if (found.isEmpty() || !Hashing.bcryptVerify(body.password, found.get().passwordHash)) {
                Servlets.error(res, 401, "Invalid credentials");
                return;
            }

            User user = found.get();
            String accessToken = JwtService.get().issueAccess(user.id);

            // Refresh token format: "{userId}:{uuid}" — lets the refresh endpoint extract
            // the userId without needing a valid access token.
            String uuid         = UUID.randomUUID().toString();
            String refreshToken = user.id + ":" + uuid;
            AppConfig.get().getRedisClient()
                    .setex("refresh:" + user.id + ":" + uuid, CookieHelper.REFRESH_MAX_AGE, "1");

            // Deliver both tokens as HttpOnly cookies — never exposed to JavaScript.
            CookieHelper.setAccessCookie(res, accessToken);
            CookieHelper.setRefreshCookie(res, refreshToken);

            Servlets.ok(res, Map.of("userId", user.id, "message", "Logged in"));

        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
