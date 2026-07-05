package com.arattai.ws;

import java.util.UUID;

/** Inbound WebSocket frame from the client. */
public class Frame {
    public String type;         // SEND_MESSAGE | TYPING | READ_RECEIPT | PING
    public String chatId;
    public String clientMsgId;  // client-generated idempotency key
    public String content;
    public String mediaUrl;
    public UUID   lastReadId;   // for READ_RECEIPT
    public long   senderId;     // filled in server-side from session, not trusted from client
}
