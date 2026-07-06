package com.arattai.repo.cassandra;

import com.arattai.dto.chat.MessageResponse;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class MessageDao {

    private final CqlSession   session;
    private final PreparedStatement insertDedup;
    private final PreparedStatement insertMsg;
    private final PreparedStatement selectHistory;

    public MessageDao(CqlSession session) {
        this.session = session;

        insertDedup = session.prepare(
            "INSERT INTO message_dedup (chat_id, client_msg_id, message_id) " +
            "VALUES (?, ?, ?) IF NOT EXISTS USING TTL 86400"
        );

        insertMsg = session.prepare(
            "INSERT INTO messages_by_chat (chat_id, message_id, sender_id, content, media_url) " +
            "VALUES (?, ?, ?, ?, ?)"
        );

        selectHistory = session.prepare(
            "SELECT * FROM messages_by_chat WHERE chat_id = ? AND message_id < ? LIMIT ?"
        );
    }

    /**
     * Idempotent insert — returns true if this is a new message, false if a duplicate.
     */
    public boolean insertDedup(String chatId, String clientMsgId, UUID messageId) {
        BoundStatement bs = insertDedup.bind(chatId, clientMsgId, messageId);
        return session.execute(bs).wasApplied();
    }

    public void insert(String chatId, UUID messageId, long senderId, String content, String mediaUrl) {
        BoundStatement bs = insertMsg.bind(chatId, messageId, senderId, content, mediaUrl);
        session.execute(bs);
    }

    public List<MessageResponse> getHistory(String chatId, UUID beforeId, int limit) {
        BoundStatement bs = selectHistory.bind(chatId, beforeId, limit);
        List<MessageResponse> result = new ArrayList<>();
        for (Row row : session.execute(bs)) {
            MessageResponse m = new MessageResponse();
            UUID id     = row.getUuid("message_id");
            m.messageId = id;
            m.chatId    = chatId;
            m.senderId  = row.getLong("sender_id");
            m.content   = row.getString("content");
            m.mediaUrl  = row.getString("media_url");
            // message_id is a TimeUUID — the send time is embedded in it
            m.createdAt = id != null ? Instant.ofEpochMilli(Uuids.unixTimestamp(id)) : null;
            result.add(m);
        }
        return result;
    }

    /** Get existing message_id for a duplicate client_msg_id. */
    public UUID getDedupMessageId(String chatId, String clientMsgId) {
        Row row = session.execute(
            session.prepare("SELECT message_id FROM message_dedup WHERE chat_id = ? AND client_msg_id = ?")
                   .bind(chatId, clientMsgId)
        ).one();
        return row != null ? row.getUuid("message_id") : null;
    }
}