package com.arattai.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public class
ClaudeProvider implements AiProvider {

    private static final String ENDPOINT        = "https://api.anthropic.com/v1/messages";
    private static final String MODEL           = "claude-sonnet-4-6";
    private static final String ANTHROPIC_VER   = "2023-06-01";
    private static final int    MAX_TOKENS      = 1024;

    private final String     apiKey;
    private final HttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public ClaudeProvider(String apiKey) {
        this.apiKey = apiKey;
        this.http   = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String complete(List<Map<String, String>> messages) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model",      MODEL);
        body.put("max_tokens", MAX_TOKENS);

        // Claude API requires system as a top-level field, not inside messages
        messages.stream()
                .filter(m -> "system".equals(m.get("role")))
                .findFirst()
                .ifPresent(m -> body.put("system", m.get("content")));

        ArrayNode msgsNode = body.putArray("messages");
        for (Map<String, String> m : messages) {
            if ("system".equals(m.get("role"))) continue;
            ObjectNode msg = msgsNode.addObject();
            msg.put("role",    m.get("role"));
            msg.put("content", m.get("content"));
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(ENDPOINT))
                .header("x-api-key",        apiKey)
                .header("anthropic-version", ANTHROPIC_VER)
                .header("Content-Type",      "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new RuntimeException("Claude API error: " + res.statusCode() + " " + res.body());
        }

        JsonNode root = mapper.readTree(res.body());
        return root.at("/content/0/text").asText();
    }
}
