package com.arattai.web.group;

import com.arattai.dto.group.AddMemberRequest;
import com.arattai.service.GroupService;
import com.arattai.util.Json;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * POST /api/subgroups/{id}/members
 */
public class SubGroupServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        String path = req.getPathInfo();
        if (path == null) { Servlets.error(res, 400, "Invalid path"); return; }

        String[] segments = path.split("/");
        // ["", "{subGroupId}", "members"]
        if (segments.length != 3 || !segments[2].equals("members")) {
            Servlets.error(res, 404, "Not found");
            return;
        }

        try {
            long subGroupId = Long.parseLong(segments[1]);
            AddMemberRequest body = Json.read(req.getInputStream(), AddMemberRequest.class);
            GroupService.addSubGroupMember(subGroupId, body.userId);
            Servlets.ok(res, Map.of("message", "Member added to subgroup"));
        } catch (NumberFormatException e) {
            Servlets.error(res, 400, "Invalid subgroup id");
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
