package com.arattai.web.auth;

import com.arattai.auth.GoogleOAuthService;
import com.arattai.cache.RedisClient;
import com.arattai.config.AppConfig;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.UUID;

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth2 login flow.
 * Generates a CSRF state token, stores it in Redis for 10 minutes,
 * then redirects the browser to Google's authorization page.
 */
public class GoogleAuthServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthServlet.class);

    private static final int STATE_TTL = 600; // 10 minutes

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        log.info("[OAuth2] STEP 1 — Google login initiated from {}", req.getRemoteAddr());

        GoogleOAuthService google = GoogleOAuthService.get();
        if (!google.isConfigured()) {
            log.error("[OAuth2] FAILURE — Google OAuth is not configured (missing client id/secret/redirect uri)");
            Servlets.error(res, 503, "Google OAuth is not configured");
            return;
        }

        String state = UUID.randomUUID().toString();
        RedisClient redis = AppConfig.get().getRedisClient();
        redis.setex("oauth_state:" + state, STATE_TTL, "1");
        log.debug("[OAuth2] STEP 2 — CSRF state generated and stored in Redis (state={}, ttl={}s)", state, STATE_TTL);

        String authUrl = google.buildAuthUrl(state);
        log.info("[OAuth2] STEP 3 — Redirecting browser to Google authorization page");
        log.debug("[OAuth2] STEP 3 — Google auth URL: {}", authUrl);
        res.sendRedirect(authUrl);
    }
}
