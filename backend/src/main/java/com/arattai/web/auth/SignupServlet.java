package com.arattai.web.auth;

import com.arattai.config.AppConfig;
import com.arattai.dto.auth.SignupRequest;
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

public class SignupServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        SignupRequest body;
        try {
            body = Json.read(req.getInputStream(), SignupRequest.class);
        } catch (Exception e) {
            Servlets.error(res, 400, "Invalid request body");
            return;
        }

        if (isBlank(body.name) || isBlank(body.username) || isBlank(body.email) || isBlank(body.password)) {
            Servlets.error(res, 400, "name, username, email, and password are required");
            return;
        }

        try {
            AppConfig cfg = AppConfig.get();
            if (cfg.getUserDao().emailExists(body.email)) {
                Servlets.error(res, 409, "Email already registered");
                return;
            }
            if (cfg.getUserDao().usernameExists(body.username)) {
                Servlets.error(res, 409, "Username already taken");
                return;
            }

            User user = new User();
            user.name         = body.name;
            user.username     = body.username;
            user.email        = body.email;
            user.passwordHash = Hashing.bcrypt(body.password);

            long userId = cfg.getUserDao().insert(user);
            Servlets.created(res, Map.of("userId", userId, "message", "Account created"));

        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
