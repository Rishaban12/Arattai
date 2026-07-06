package com.arattai.repo.cassandra;

import com.arattai.dto.chat.ConversationResponse;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class ConversationDao {

    private final CqlSession        session;
    private final PreparedStatement selectByUser;
    private final PreparedStatement upsert;
    private final PreparedStatement deleteRow;

    public ConversationDao(CqlSession session) {
        this.session = session;

        selectByUser = session.prepare(
            "SELECT * FROM conversations_by_user WHERE user_id = ? LIMIT 50"
        );

        upsert = session.prepare(
            "INSERT INTO conversations_by_user " +
            "(user_id, chat_id, chat_name, last_message, last_message_at, unread_count) " +
            "VALUES (?, ?, ?, ?, ?, ?)"
        );

        deleteRow = session.prepare(
            "DELETE FROM conversations_by_user WHERE user_id = ? AND chat_id = ?"
        );
    }

    public List<ConversationResponse> getConversations(long userId) {
        BoundStatement bs = selectByUser.bind(userId);
        List<ConversationResponse> result = new ArrayList<>();
        for (Row row : session.execute(bs)) {
            ConversationResponse c = new ConversationResponse();
            c.chatId        = row.getString("chat_id");
            c.chatName      = row.getString("chat_name");
            c.lastMessage   = row.getString("last_message");
            c.lastMessageAt = row.getInstant("last_message_at");
            c.unreadCount   = row.getInt("unread_count");
            result.add(c);
        }
        return result;
    }

    public void upsert(long userId, String chatId, String chatName,
                       String lastMessage, Instant lastMessageAt, int unreadCount) {
        BoundStatement bs = upsert.bind(userId, chatId, chatName, lastMessage, lastMessageAt, unreadCount);
        session.execute(bs);
    }

    /** Removes the chat from this user's inbox only — messages stay in Cassandra. */
    public void delete(long userId, String chatId) {
        session.execute(deleteRow.bind(userId, chatId));
    }
}