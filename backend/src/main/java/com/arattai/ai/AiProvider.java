package com.arattai.ai;

import java.util.List;
import java.util.Map;

public interface AiProvider {

    /**
     * Send a conversation history and return the next assistant reply.
     * Each map must have "role" ("user" or "assistant") and "content".
     */
    String complete(List<Map<String, String>> messages) throws Exception;
}

