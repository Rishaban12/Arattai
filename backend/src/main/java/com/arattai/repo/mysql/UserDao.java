package com.arattai.repo.mysql;

import com.arattai.model.User;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class UserDao {

    private final DataSource ds;

    public UserDao(DataSource ds) {
        this.ds = ds;
    }

    public long insert(User u) throws SQLException {
        String sql = "INSERT INTO users (name, username, email, password_hash, avatar_url) VALUES (?,?,?,?,?)";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, u.name);
            ps.setString(2, u.username);
            ps.setString(3, u.email);
            ps.setString(4, u.passwordHash);
            ps.setString(5, u.avatarUrl);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    /** Inserts a Google OAuth user (no password hash). */
    public long insertOAuthUser(User u) throws SQLException {
        String sql = "INSERT INTO users (name, username, email, google_id, avatar_url) VALUES (?,?,?,?,?)";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, u.name);
            ps.setString(2, u.username);
            ps.setString(3, u.email);
            ps.setString(4, u.googleId);
            ps.setString(5, u.avatarUrl);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    public Optional<User> findByGoogleId(String googleId) throws SQLException {
        String sql = "SELECT * FROM users WHERE google_id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, googleId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    /** Links a Google identity to an existing account that signed up with email. */
    public void linkGoogleId(long userId, String googleId) throws SQLException {
        String sql = "UPDATE users SET google_id = ? WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, googleId);
            ps.setLong(2, userId);
            ps.executeUpdate();
        }
    }

    public Optional<User> findByEmail(String email) throws SQLException {
        String sql = "SELECT * FROM users WHERE email = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    public Optional<User> findById(long id) throws SQLException {
        String sql = "SELECT * FROM users WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    /** All users except the given one — the caller's contact list. */
    public List<User> listAllExcept(long userId) throws SQLException {
        String sql = "SELECT * FROM users WHERE id <> ? ORDER BY name";
        List<User> users = new ArrayList<>();
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) users.add(map(rs));
            }
        }
        return users;
    }

    public void update(long id, String name, String avatarUrl) throws SQLException {
        String sql = "UPDATE users SET name = ?, avatar_url = ? WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, avatarUrl);
            ps.setLong(3, id);
            ps.executeUpdate();
        }
    }

    public boolean usernameExists(String username) throws SQLException {
        String sql = "SELECT 1 FROM users WHERE username = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public boolean emailExists(String email) throws SQLException {
        String sql = "SELECT 1 FROM users WHERE email = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private User map(ResultSet rs) throws SQLException {
        User u = new User();
        u.id           = rs.getLong("id");
        u.name         = rs.getString("name");
        u.username     = rs.getString("username");
        u.email        = rs.getString("email");
        u.passwordHash = rs.getString("password_hash");
        u.googleId     = rs.getString("google_id");
        u.avatarUrl    = rs.getString("avatar_url");
        u.createdAt    = rs.getTimestamp("created_at").toInstant();
        return u;
    }
}