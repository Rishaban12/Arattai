package com.arattai.auth;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

public class AuthFilter extends HttpFilter {

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/signup",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/logout",         // logout reads its own cookies; no auth header required
            "/api/auth/google",         // initiates Google OAuth redirect
            "/api/auth/google/callback",// receives Google redirect
            "/api/ai/chat",
            "/api/ai/transform"
    );

    private final ObjectMapper json = new ObjectMapper();

    @Override
    protected void doFilter(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        String path = req.getServletPath();
        if (PUBLIC_PATHS.contains(path)) {
            chain.doFilter(req, res);
            return;
        }

        // 1. Prefer HttpOnly cookie (browser clients)
        String token = CookieHelper.readCookie(req, CookieHelper.ACCESS_COOKIE);

        // 2. Fall back to Authorization header (mobile / API clients)
        if (token == null || token.isBlank()) {
            String header = req.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                token = header.substring(7);
            }
        }

        if (token == null || token.isBlank()) {
            deny(res, "Authentication required");
            return;
        }

        try {
            DecodedJWT jwt = JwtService.get().verify(token);
            req.setAttribute("userId", Long.parseLong(jwt.getSubject()));
            chain.doFilter(req, res);
        } catch (JWTVerificationException e) {
            deny(res, "Invalid or expired token");
        }
    }

    private void deny(HttpServletResponse res, String msg) throws IOException {
        res.setStatus(401);
        res.setContentType("application/json");
        res.getWriter().write(json.writeValueAsString(Map.of("error", msg)));
    }
}