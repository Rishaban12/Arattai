package com.arattai.web.user;

import com.arattai.config.AppConfig;
import com.arattai.dto.user.UpdateUserRequest;
import com.arattai.dto.user.UserResponse;
import com.arattai.model.User;
import com.arattai.util.Json;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

public class MeServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        long userId = Servlets.userId(req);
        try {
            Optional<User> user = AppConfig.get().getUserDao().findById(userId);
            if (user.isEmpty()) { Servlets.error(res, 404, "User not found"); return; }
            Servlets.ok(res, UserResponse.from(user.get()));
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        long userId = Servlets.userId(req);
        UpdateUserRequest body;
        try {
            body = Json.read(req.getInputStream(), UpdateUserRequest.class);
        } catch (Exception e) {
            Servlets.error(res, 400, "Invalid request body");
            return;
        }

        try {
            AppConfig.get().getUserDao().update(userId, body.name, body.avatarUrl);
            Optional<User> updated = AppConfig.get().getUserDao().findById(userId);
            Servlets.ok(res, UserResponse.from(updated.get()));
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
