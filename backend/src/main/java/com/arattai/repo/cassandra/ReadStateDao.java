package com.arattai.repo.cassandra;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;

import java.util.UUID;

public class ReadStateDao {

    private final CqlSession        session;
    private final PreparedStatement upsert;
    private final PreparedStatement select;

    public ReadStateDao(CqlSession session) {
        this.session = session;

        upsert = session.prepare(
            "INSERT INTO read_state (chat_id, user_id, last_read_id) VALUES (?, ?, ?)"
        );

        select = session.prepare(
            "SELECT last_read_id FROM read_state WHERE chat_id = ? AND user_id = ?"
        );
    }

    public void markRead(String chatId, long userId, UUID lastReadId) {
        BoundStatement bs = upsert.bind(chatId, userId, lastReadId);
        session.execute(bs);
    }

    public UUID getLastRead(String chatId, long userId) {
        Row row = session.execute(select.bind(chatId, userId)).one();
        return row != null ? row.getUuid("last_read_id") : null;
    }
}