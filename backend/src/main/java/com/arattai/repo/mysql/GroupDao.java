package com.arattai.repo.mysql;

import com.arattai.model.Group;
import com.arattai.model.SubGroup;
import com.arattai.model.User;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class GroupDao {

    private final DataSource ds;

    public GroupDao(DataSource ds) {
        this.ds = ds;
    }

    // ── Groups ───────────────────────────────────────────────────────────────

    public long createGroup(String name, long ownerId) throws SQLException {
        String sql = "INSERT INTO groups_ (name, owner_id) VALUES (?,?)";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setLong(2, ownerId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                rs.next();
                long groupId = rs.getLong(1);
                addGroupMember(c, groupId, ownerId, "owner");
                return groupId;
            }
        }
    }

    public Optional<Group> findGroupById(long id) throws SQLException {
        String sql = "SELECT * FROM groups_ WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapGroup(rs)) : Optional.empty();
            }
        }
    }

    public void addGroupMember(long groupId, long userId, String role) throws SQLException {
        try (Connection c = ds.getConnection()) {
            addGroupMember(c, groupId, userId, role);
        }
    }

    private void addGroupMember(Connection c, long groupId, long userId, String role) throws SQLException {
        String sql = "INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?,?,?)";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, groupId);
            ps.setLong(2, userId);
            ps.setString(3, role);
            ps.executeUpdate();
        }
    }

    public void removeGroupMember(long groupId, long userId) throws SQLException {
        String sql = "DELETE FROM group_members WHERE group_id = ? AND user_id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, groupId);
            ps.setLong(2, userId);
            ps.executeUpdate();
        }
    }

    public boolean isMember(long groupId, long userId) throws SQLException {
        String sql = "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, groupId);
            ps.setLong(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    // ── SubGroups ─────────────────────────────────────────────────────────────

    public long createSubGroup(long groupId, String name) throws SQLException {
        String sql = "INSERT INTO subgroups (group_id, name) VALUES (?,?)";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, groupId);
            ps.setString(2, name);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    public List<Group> listGroupsForUser(long userId) throws SQLException {
        String sql = "SELECT g.* FROM groups_ g " +
                     "JOIN group_members gm ON g.id = gm.group_id " +
                     "WHERE gm.user_id = ? ORDER BY g.created_at DESC";
        List<Group> groups = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) groups.add(mapGroup(rs));
            }
        }
        return groups;
    }

    public List<SubGroup> listSubGroupsByGroup(long groupId) throws SQLException {
        String sql = "SELECT * FROM subgroups WHERE group_id = ? ORDER BY created_at ASC";
        List<SubGroup> list = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, groupId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapSubGroup(rs));
            }
        }
        return list;
    }

    public Optional<SubGroup> findSubGroupById(long id) throws SQLException {
        String sql = "SELECT * FROM subgroups WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapSubGroup(rs)) : Optional.empty();
            }
        }
    }

    public void addSubGroupMember(long subGroupId, long userId) throws SQLException {
        // group_id is NOT NULL — derive it from the subgroup row. A plain
        // INSERT IGNORE without it silently skips the insert.
        String sql = "INSERT IGNORE INTO subgroup_members (group_id, subgroup_id, user_id) " +
                     "SELECT group_id, id, ? FROM subgroups WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ps.setLong(2, subGroupId);
            ps.executeUpdate();
        }
    }

    /** Full user rows of everyone currently in the group. */
    public List<User> listMembers(long groupId) throws SQLException {
        String sql = "SELECT u.* FROM users u " +
                     "JOIN group_members gm ON u.id = gm.user_id " +
                     "WHERE gm.group_id = ? AND gm.left_at IS NULL ORDER BY u.name";
        List<User> members = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, groupId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) members.add(mapUser(rs));
            }
        }
        return members;
    }

    public List<Long> getMemberIds(long groupId) throws SQLException {
        String sql = "SELECT user_id FROM group_members WHERE group_id = ?";
        List<Long> ids = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, groupId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) ids.add(rs.getLong("user_id"));
            }
        }
        return ids;
    }

    public List<Long> getSubGroupMemberIds(long subGroupId) throws SQLException {
        String sql = "SELECT user_id FROM subgroup_members WHERE subgroup_id = ?";
        List<Long> ids = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, subGroupId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) ids.add(rs.getLong("user_id"));
            }
        }
        return ids;
    }

    // ── Device tokens ─────────────────────────────────────────────────────────

    public void upsertDeviceToken(long userId, String token, String platform) throws SQLException {
        String sql = "INSERT INTO device_tokens (user_id, token, platform) VALUES (?,?,?) " +
                     "ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ps.setString(2, token);
            ps.setString(3, platform);
            ps.executeUpdate();
        }
    }

    public List<String> getDeviceTokens(long userId) throws SQLException {
        String sql = "SELECT token FROM device_tokens WHERE user_id = ?";
        List<String> tokens = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) tokens.add(rs.getString("token"));
            }
        }
        return tokens;
    }

    // ── Mappers ──────────────────────────────────────────────────────────────

    private Group mapGroup(ResultSet rs) throws SQLException {
        Group g = new Group();
        g.id        = rs.getLong("id");
        g.name      = rs.getString("name");
        g.ownerId   = rs.getLong("owner_id");
        g.createdAt = rs.getTimestamp("created_at").toInstant();
        return g;
    }

    private User mapUser(ResultSet rs) throws SQLException {
        User u = new User();
        u.id        = rs.getLong("id");
        u.name      = rs.getString("name");
        u.username  = rs.getString("username");
        u.email     = rs.getString("email");
        u.avatarUrl = rs.getString("avatar_url");
        u.createdAt = rs.getTimestamp("created_at").toInstant();
        return u;
    }

    private SubGroup mapSubGroup(ResultSet rs) throws SQLException {
        SubGroup sg = new SubGroup();
        sg.id        = rs.getLong("id");
        sg.groupId   = rs.getLong("group_id");
        sg.name      = rs.getString("name");
        sg.createdAt = rs.getTimestamp("created_at").toInstant();
        return sg;
    }
}