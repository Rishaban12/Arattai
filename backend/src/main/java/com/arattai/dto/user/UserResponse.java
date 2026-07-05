package com.arattai.dto.user;

import com.arattai.model.User;

import java.time.Instant;

public class UserResponse {
    public long    id;
    public String  name;
    public String  username;
    public String  email;
    public String  avatarUrl;
    public Instant createdAt;

    public static UserResponse from(User u) {
        UserResponse r = new UserResponse();
        r.id        = u.id;
        r.name      = u.name;
        r.username  = u.username;
        r.email     = u.email;
        r.avatarUrl = u.avatarUrl;
        r.createdAt = u.createdAt;
        return r;
    }
}