package com.arattai.dto.group;

import com.arattai.model.Group;

import java.time.Instant;

public class GroupResponse {
    public long    id;
    public String  name;
    public long    ownerId;
    public Instant createdAt;

    public static GroupResponse from(Group g) {
        GroupResponse r = new GroupResponse();
        r.id        = g.id;
        r.name      = g.name;
        r.ownerId   = g.ownerId;
        r.createdAt = g.createdAt;
        return r;
    }
}