package com.arattai.util;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

public final class Servlets {

    private Servlets() {}

    public static void sendJson(HttpServletResponse res, int status, Object body) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write(Json.write(body));
    }

    public static void ok(HttpServletResponse res, Object body) throws IOException {
        sendJson(res, 200, body);
    }

    public static void created(HttpServletResponse res, Object body) throws IOException {
        sendJson(res, 201, body);
    }

    public static void error(HttpServletResponse res, int status, String message) throws IOException {
        sendJson(res, status, Map.of("error", message));
    }

    public static long userId(HttpServletRequest req) {
        return (long) req.getAttribute("userId");
    }

    /** Extracts the last path segment: /api/users/42 → "42" */
    public static String pathId(HttpServletRequest req) {
        String path = req.getPathInfo();
        if (path == null || path.equals("/")) return null;
        String[] parts = path.split("/");
        return parts[parts.length - 1];
    }
}