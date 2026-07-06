package com.arattai.ws;

import java.util.UUID;

/** Inbound WebSocket frame from the client. */
public class Frame {
    public String type;         // SEND_MESSAGE | TYPING | READ_RECEIPT | PING | CALL_*
    public String chatId;
    public String clientMsgId;  // client-generated idempotency key
    public String content;
    public String mediaUrl;
    public UUID   lastReadId;   // for READ_RECEIPT
    public long   senderId;     // filled in server-side from session, not trusted from client

    // Call signaling (CALL_OFFER | CALL_ANSWER | CALL_ICE | CALL_REJECT | CALL_END)
    public long   targetId;     // user being called / signaled
    public String callId;       // caller-generated id shared by all frames of one call
    public String media;        // "audio" | "video" (CALL_OFFER only)
    public String payload;      // SDP or ICE candidate, JSON-encoded, relayed opaquely
}
