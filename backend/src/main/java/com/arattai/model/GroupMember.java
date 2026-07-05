package com.arattai.model;

import java.time.Instant;

public class GroupMember {
    public long    groupId;
    public long    userId;
    public String  role;      // "owner" | "admin" | "member"
    public Instant joinedAt;
}