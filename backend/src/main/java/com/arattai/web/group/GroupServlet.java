package com.arattai.web.group;

import com.arattai.dto.group.AddMemberRequest;
import com.arattai.dto.group.CreateGroupRequest;
import com.arattai.dto.group.CreateSubGroupRequest;
import com.arattai.dto.group.GroupResponse;
import com.arattai.dto.group.SubGroupResponse;
import com.arattai.model.Group;
import com.arattai.model.SubGroup;
import com.arattai.service.GroupService;
import com.arattai.util.Json;
import com.arattai.util.Servlets;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Routes:
 *   POST   /api/groups             → create group
 *   GET    /api/groups/{id}        → get group
 *   POST   /api/groups/{id}/members
 *   DELETE /api/groups/{id}/members/{userId}
 *   POST   /api/groups/{id}/subgroups
 */
public class GroupServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        long actorId  = Servlets.userId(req);
        String path   = req.getPathInfo();  // null → "/", "/{id}", "/{id}/members", "/{id}/subgroups"

        try {
            if (path == null || path.equals("/") || path.isEmpty()) {
                // POST /api/groups — create group
                CreateGroupRequest body = Json.read(req.getInputStream(), CreateGroupRequest.class);
                if (body.name == null || body.name.isBlank()) {
                    Servlets.error(res, 400, "name is required");
                    return;
                }
                long groupId;
                try {
                    groupId = GroupService.createGroup(body.name.trim(), actorId);
                } catch (SQLIntegrityConstraintViolationException e) {
                    Servlets.error(res, 409, "A group with this name already exists");
                    return;
                }
                Servlets.created(res, Map.of("id", groupId));
                return;
            }

            String[] segments = path.split("/");  // ["", "{id}"], ["", "{id}", "members"], etc.
            long groupId = Long.parseLong(segments[1]);

            if (segments.length == 3 && segments[2].equals("members")) {
                // POST /api/groups/{id}/members
                AddMemberRequest body = Json.read(req.getInputStream(), AddMemberRequest.class);
                if (!GroupService.isMember(groupId, actorId)) {
                    Servlets.error(res, 403, "Not a member of this group");
                    return;
                }
                GroupService.addMember(groupId, body.userId, body.role);
                Servlets.ok(res, Map.of("message", "Member added"));

            } else if (segments.length == 3 && segments[2].equals("subgroups")) {
                // POST /api/groups/{id}/subgroups
                CreateSubGroupRequest body = Json.read(req.getInputStream(), CreateSubGroupRequest.class);
                if (!GroupService.isMember(groupId, actorId)) {
                    Servlets.error(res, 403, "Not a member of this group");
                    return;
                }
                long subGroupId;
                try {
                    subGroupId = GroupService.createSubGroup(groupId, body.name.trim());
                } catch (SQLIntegrityConstraintViolationException e) {
                    Servlets.error(res, 409, "A subgroup with this name already exists in this group");
                    return;
                }
                // Creator is always a member of their own subgroup
                GroupService.addSubGroupMember(subGroupId, actorId);
                Servlets.created(res, Map.of("id", subGroupId));

            } else {
                Servlets.error(res, 404, "Not found");
            }

        } catch (NumberFormatException e) {
            Servlets.error(res, 400, "Invalid group id");
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        long userId = Servlets.userId(req);
        String path = req.getPathInfo();

        try {
            if (path == null || path.equals("/") || path.isEmpty()) {
                // GET /api/groups — list all groups the current user belongs to
                List<Group> groups = GroupService.listGroupsForUser(userId);
                Servlets.ok(res, groups.stream().map(GroupResponse::from).toList());
                return;
            }

            String[] segments = path.split("/");
            long groupId = Long.parseLong(segments[1]);

            if (segments.length == 3 && segments[2].equals("subgroups")) {
                // GET /api/groups/{id}/subgroups
                List<SubGroup> subs = GroupService.listSubGroupsByGroup(groupId);
                Servlets.ok(res, subs.stream().map(SubGroupResponse::from).toList());
                return;
            }

            if (segments.length == 3 && segments[2].equals("members")) {
                // GET /api/groups/{id}/members — only visible to members
                if (!GroupService.isMember(groupId, userId)) {
                    Servlets.error(res, 403, "Not a member of this group");
                    return;
                }
                Servlets.ok(res, GroupService.listGroupMembers(groupId).stream()
                        .map(com.arattai.dto.user.UserResponse::from).toList());
                return;
            }

            // GET /api/groups/{id}
            Optional<Group> group = GroupService.getGroup(groupId);
            if (group.isEmpty()) { Servlets.error(res, 404, "Group not found"); return; }
            Servlets.ok(res, GroupResponse.from(group.get()));

        } catch (NumberFormatException e) {
            Servlets.error(res, 400, "Invalid group id");
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        // DELETE /api/groups/{id}/members/{userId}
        String path = req.getPathInfo();
        if (path == null) { Servlets.error(res, 400, "Invalid path"); return; }

        String[] segments = path.split("/");
        // ["", "{groupId}", "members", "{userId}"]
        if (segments.length != 4 || !segments[2].equals("members")) {
            Servlets.error(res, 400, "Invalid path");
            return;
        }

        try {
            long groupId       = Long.parseLong(segments[1]);
            long targetUserId  = Long.parseLong(segments[3]);
            long actorId       = Servlets.userId(req);

            if (!GroupService.isMember(groupId, actorId)) {
                Servlets.error(res, 403, "Not a member of this group");
                return;
            }
            GroupService.removeMember(groupId, targetUserId);
            Servlets.ok(res, Map.of("message", "Member removed"));

        } catch (NumberFormatException e) {
            Servlets.error(res, 400, "Invalid id");
        } catch (Exception e) {
            Servlets.error(res, 500, "Internal error");
        }
    }
}
