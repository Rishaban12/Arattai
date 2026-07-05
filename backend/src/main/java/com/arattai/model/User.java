package com.arattai.model;

import java.time.Instant;

public class User {
    public long    id;
    public String  name;
    public String  username;
    public String  email;
    public String  passwordHash; // null for Google-only accounts
    public String  googleId;
    public String  avatarUrl;
    public Instant createdAt;
}