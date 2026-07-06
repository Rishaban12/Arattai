package com.arattai.service;

import com.arattai.config.AppConfig;
import com.arattai.model.Group;
import com.arattai.model.SubGroup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public final class GroupService {

    private GroupService() {}

    private static final Logger log = LoggerFactory.getLogger(GroupService.class);

    public static long createGroup(String name, long ownerId) throws SQLException {
        return AppConfig.get().getGroupDao().createGroup(name, ownerId);
    }

    public static Optional<Group> getGroup(long groupId) throws SQLException {
        return AppConfig.get().getGroupDao().findGroupById(groupId);
    }

    public static void addMember(long groupId, long userId, String role) throws SQLException {
        AppConfig.get().getGroupDao().addGroupMember(groupId, userId, role != null ? role : "member");
    }

    public static void removeMember(long groupId, long userId) throws SQLException {
        AppConfig.get().getGroupDao().removeGroupMember(groupId, userId);
    }

    public static boolean isMember(long groupId, long userId) throws SQLException {
        return AppConfig.get().getGroupDao().isMember(groupId, userId);
    }

    public static List<Group> listGroupsForUser(long userId) throws SQLException {
        return AppConfig.get().getGroupDao().listGroupsForUser(userId);
    }

    public static List<com.arattai.model.User> listGroupMembers(long groupId) throws SQLException {
        return AppConfig.get().getGroupDao().listMembers(groupId);
    }

    public static List<SubGroup> listSubGroupsByGroup(long groupId) throws SQLException {
        return AppConfig.get().getGroupDao().listSubGroupsByGroup(groupId);
    }

    public static long createSubGroup(long groupId, String name) throws SQLException {
        return AppConfig.get().getGroupDao().createSubGroup(groupId, name);
    }

    public static Optional<SubGroup> getSubGroup(long subGroupId) throws SQLException {
        return AppConfig.get().getGroupDao().findSubGroupById(subGroupId);
    }

    public static void addSubGroupMember(long subGroupId, long userId) throws SQLException {
        AppConfig.get().getGroupDao().addSubGroupMember(subGroupId, userId);
    }
}
