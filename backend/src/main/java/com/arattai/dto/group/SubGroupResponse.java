package com.arattai.dto.group;

import com.arattai.model.SubGroup;

import java.time.Instant;

public class SubGroupResponse {
    public long    id;
    public long    groupId;
    public String  name;
    public Instant createdAt;

    public static SubGroupResponse from(SubGroup sg) {
        SubGroupResponse r = new SubGroupResponse();
        r.id        = sg.id;
        r.groupId   = sg.groupId;
        r.name      = sg.name;
        r.createdAt = sg.createdAt;
        return r;
    }
}
