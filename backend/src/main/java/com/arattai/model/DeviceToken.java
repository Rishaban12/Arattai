package com.arattai.model;

import java.time.Instant;

public class DeviceToken {
    public long    id;
    public long    userId;
    public String  token;
    public String  platform;  // "fcm" | "apns"
    public Instant createdAt;
}