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

public class OpenAiProvider implements AiProvider {

    private static final String ENDPOINT = "https://api.openai.com/v1/chat/completions";
    private static final String MODEL    = "gpt-4o-mini";

    private final String     apiKey;
    private final HttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public OpenAiProvider(String apiKey) {
        this.apiKey = apiKey;
        this.http   = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String complete(List<Map<String, String>> messages) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", MODEL);
        ArrayNode msgsNode = body.putArray("messages");
        for (Map<String, String> m : messages) {
            ObjectNode msg = msgsNode.addObject();
            msg.put("role",    m.get("role"));
            msg.put("content", m.get("content"));
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(ENDPOINT))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new RuntimeException("OpenAI API error: " + res.statusCode() + " " + res.body());
        }

        JsonNode root = mapper.readTree(res.body());
        return root.at("/choices/0/message/content").asText();
    }
}
