package com.arattai.dto.chat;

import java.time.Instant;

public class ConversationResponse {
    public String  chatId;
    public String  chatName;
    public String  lastMessage;
    public Instant lastMessageAt;
    public int     unreadCount;
}