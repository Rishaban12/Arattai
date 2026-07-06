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
import java.util.List;

/**
 * GET /api/contacts — every user except the caller.
 */
public class ContactsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {
        long userId = Servlets.userId(req);
        try {
            List<User> users = AppConfig.get().getUserDao().listAllExcept(userId);
            Servlets.ok(res, users.stream().map(UserResponse::from).toList());
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
