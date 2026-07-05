package com.arattai.messaging;

import java.time.Instant;
import java.util.UUID;

public class KafkaEvent {
    public String  type;        // "NEW_MESSAGE" | "AI_REQUEST" | etc.
    public String  chatId;
    public UUID    messageId;
    public long    senderId;
    public String  content;
    public String  mediaUrl;
    public Instant timestamp;
}
