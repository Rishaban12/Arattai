package com.arattai.auth;

import com.arattai.config.Env;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Centralises all Set-Cookie logic for auth tokens.
 *
 * Both cookies are HttpOnly (no JS access) and SameSite=Strict.
 * The Secure flag is ON by default; set COOKIE_SECURE=false in .env for plain-HTTP dev.
 *
 * Cookie format:
 *   access_token  = signed JWT,          Path=/,   Max-Age=604 800 s  (7 days)
 *   refresh_token = "{userId}:{uuid}",   Path=/,   Max-Age=604 800 s  (7 days)
 */
public final class CookieHelper {

    private CookieHelper() {}

    public static final String ACCESS_COOKIE   = "access_token";
    public static final String REFRESH_COOKIE  = "refresh_token";

    public static final int ACCESS_MAX_AGE  = 604_800;     // 7 days
    public static final int REFRESH_MAX_AGE = 604_800;     // 7 days

    // Evaluated lazily at first use so Env is populated before this reads it
    private static boolean isSecure() {
        return !"false".equalsIgnoreCase(Env.getOrDefault("COOKIE_SECURE", "true"));
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    public static void setAccessCookie(HttpServletResponse res, String token) {
        addCookie(res, ACCESS_COOKIE, token, "/", ACCESS_MAX_AGE);
    }

    public static void setRefreshCookie(HttpServletResponse res, String token) {
        addCookie(res, REFRESH_COOKIE, token, "/", REFRESH_MAX_AGE);
    }

    /** Overwrites both cookies with empty value and Max-Age=0 to expire them immediately. */
    public static void clearAuth(HttpServletResponse res) {
        addCookie(res, ACCESS_COOKIE,  "", "/", 0);
        addCookie(res, REFRESH_COOKIE, "", "/", 0);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Returns the value of the named cookie, or null if absent. */
    public static String readCookie(HttpServletRequest req, String name) {
        var cookies = req.getCookies();
        if (cookies == null) return null;
        for (var c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    /**
     * Parses a raw Cookie header string (as sent during a WebSocket handshake)
     * and returns the value of the named cookie, or null.
     */
    public static String parseCookieHeader(String header, String name) {
        if (header == null || header.isBlank()) return null;
        for (String pair : header.split(";")) {
            String[] kv = pair.strip().split("=", 2);
            if (kv.length == 2 && name.equals(kv[0].strip())) {
                return kv[1].strip();
            }
        }
        return null;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * Writes a Set-Cookie header with HttpOnly, SameSite=Strict, and optionally Secure.
     * The raw header approach is used because the Jakarta Servlet API below 6.0 has no
     * built-in SameSite support on jakarta.servlet.http.Cookie.
     */
    private static void addCookie(HttpServletResponse res,
                                   String name, String value,
                                   String path, int maxAge) {
        StringBuilder sb = new StringBuilder();
        sb.append(name).append('=').append(value);
        sb.append("; Path=").append(path);
        sb.append("; Max-Age=").append(maxAge);
        sb.append("; HttpOnly");
        sb.append("; SameSite=Strict");
        if (isSecure()) sb.append("; Secure");
        res.addHeader("Set-Cookie", sb.toString());
    }
}
