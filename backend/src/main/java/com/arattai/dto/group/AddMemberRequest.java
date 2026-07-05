package com.arattai.dto.group;

public class AddMemberRequest {
    public long   userId;
    public String role;   // "member" | "admin" — defaults to "member" if null
}