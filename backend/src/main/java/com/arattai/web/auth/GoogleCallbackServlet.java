package com.arattai.web.auth;

import com.arattai.auth.CookieHelper;
import com.arattai.auth.GoogleOAuthService;
import com.arattai.auth.GoogleOAuthService.GoogleUserInfo;
import com.arattai.auth.JwtService;
import com.arattai.cache.RedisClient;
import com.arattai.config.AppConfig;
import com.arattai.model.User;
import com.arattai.repo.mysql.UserDao;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Handles the redirect back from Google after the user consents.
 * 1. Validates the CSRF state token.
 * 2. Exchanges the authorization code for a Google access token.
 * 3. Fetches the user's Google profile.
 * 4. Finds or creates the user in MySQL.
 * 5. Issues JWT + refresh token as HttpOnly cookies.
 * 6. Redirects to the frontend app.
 */
public class GoogleCallbackServlet extends HttpServlet {

    private static final Logger log = LoggerFactory.getLogger(GoogleCallbackServlet.class);

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        log.info("[OAuth2] STEP 4 — Callback received from Google");

        GoogleOAuthService google   = GoogleOAuthService.get();
        RedisClient        redis    = AppConfig.get().getRedisClient();
        String             frontend = google.getFrontendUrl();

        // ── 1. CSRF state check ────────────────────────────────────────────────
        String state = req.getParameter("state");
        String code  = req.getParameter("code");
        String error = req.getParameter("error");

        if (error != null) {
            log.warn("[OAuth2] FAILURE — Google denied consent: {}", error);
            res.sendRedirect(frontend + "?auth=error&reason=" + error);
            return;
        }

        if (state == null || code == null) {
            log.warn("[OAuth2] FAILURE — missing params (state={}, code present={})", state, code != null);
            res.sendRedirect(frontend + "?auth=error&reason=missing_params");
            return;
        }

        String stateKey = "oauth_state:" + state;
        if (!redis.exists(stateKey)) {
            log.warn("[OAuth2] FAILURE — CSRF state invalid or expired: {}", state);
            res.sendRedirect(frontend + "?auth=error&reason=invalid_state");
            return;
        }
        redis.del(stateKey); // one-time use
        log.info("[OAuth2] STEP 5 — CSRF state validated OK");

        // ── 2 & 3. Exchange code → access token → user info ───────────────────
        GoogleUserInfo info;
        try {
            log.info("[OAuth2] STEP 6 — Exchanging code and fetching user profile");
            String accessToken = google.exchangeCode(code);
            info               = google.getUserInfo(accessToken);
        } catch (Exception e) {
            log.error("[OAuth2] FAILURE — Google API call failed during code exchange / userinfo", e);
            res.sendRedirect(frontend + "?auth=error&reason=google_api");
            return;
        }

        // ── 4. Find or create user ─────────────────────────────────────────────
        UserDao userDao = AppConfig.get().getUserDao();
        long userId;
        try {
            Optional<User> byGoogle = userDao.findByGoogleId(info.id());
            if (byGoogle.isPresent()) {
                // Returning Google user
                userId = byGoogle.get().id;
                log.info("[OAuth2] STEP 7 — Existing Google user logged in (userId={})", userId);
            } else {
                // Check if a password-based account exists with the same email
                Optional<User> byEmail = userDao.findByEmail(info.email());
                if (byEmail.isPresent()) {
                    // Link the Google identity to the existing account
                    userId = byEmail.get().id;
                    userDao.linkGoogleId(userId, info.id());
                    log.info("[OAuth2] STEP 7 — Linked Google identity to existing account (userId={}, email={})", userId, info.email());
                } else {
                    // Brand-new user — auto-create account
                    User user       = new User();
                    user.name       = info.name();
                    user.username   = deriveUsername(info.email(), userDao);
                    user.email      = info.email();
                    user.googleId   = info.id();
                    user.avatarUrl  = info.picture();
                    userId          = userDao.insertOAuthUser(user);
                    log.info("[OAuth2] STEP 7 — New user auto-created (userId={}, username={}, email={})", userId, user.username, info.email());
                }
            }
        } catch (Exception e) {
            log.error("[OAuth2] FAILURE — DB error during find-or-create user", e);
            res.sendRedirect(frontend + "?auth=error&reason=db");
            return;
        }

        // ── 5. Issue tokens as HttpOnly cookies ───────────────────────────────
        String accessToken  = JwtService.get().issueAccess(userId);
        String uuid         = UUID.randomUUID().toString();
        String refreshToken = userId + ":" + uuid;
        redis.setex("refresh:" + userId + ":" + uuid, CookieHelper.REFRESH_MAX_AGE, "1");

        CookieHelper.setAccessCookie(res, accessToken);
        CookieHelper.setRefreshCookie(res, refreshToken);
        log.info("[OAuth2] STEP 8 — JWT + refresh cookies issued (userId={})", userId);

        // ── 6. Redirect to frontend ────────────────────────────────────────────
        log.info("[OAuth2] SUCCESS — login complete, redirecting to frontend (userId={})", userId);
        res.sendRedirect(frontend + "?auth=success");
    }

    /**
     * Derives a username from the email prefix.
     * Strips non-alphanumeric chars; appends a random 4-digit suffix if taken.
     */
    private String deriveUsername(String email, UserDao userDao) throws Exception {
        String base = email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "").toLowerCase();
        if (base.length() < 3) base = base + "user";

        String candidate = base;
        while (userDao.usernameExists(candidate)) {
            candidate = base + (1000 + (int)(Math.random() * 9000));
        }
        return candidate;
    }
}
