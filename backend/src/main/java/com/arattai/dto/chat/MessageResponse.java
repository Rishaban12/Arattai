package com.arattai.dto.chat;

import java.time.Instant;
import java.util.UUID;

public class MessageResponse {
    public UUID    messageId;
    public String  chatId;
    public long    senderId;
    public String  content;
    public String  mediaUrl;
    public Instant createdAt;
}