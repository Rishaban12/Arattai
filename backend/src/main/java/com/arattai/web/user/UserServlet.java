package com.arattai.web.user;

import com.arattai.config.AppConfig;
import com.arattai.dto.user.UserResponse;
import com.arattai.model.User;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

public class UserServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        String idStr = Servlets.pathId(req);
        if (idStr == null) { Servlets.error(res, 400, "User id required"); return; }

        long userId;
        try {
            userId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            Servlets.error(res, 400, "Invalid user id");
            return;
        }

        try {
            Optional<User> user = AppConfig.get().getUserDao().findById(userId);
            if (user.isEmpty()) { Servlets.error(res, 404, "User not found"); return; }
            Servlets.ok(res, UserResponse.from(user.get()));
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
