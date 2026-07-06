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

/**
 * Works with any OpenAI-compatible chat completions API (OpenAI, NVIDIA NIM, …)
 * by pointing AI_BASE_URL / AI_MODEL at the desired service.
 */
public class OpenAiProvider implements AiProvider {

    public static final String DEFAULT_BASE_URL = "https://api.openai.com/v1";
    public static final String DEFAULT_MODEL    = "gpt-4o-mini";

    private final String     apiKey;
    private final String     endpoint;
    private final String     model;
    private final HttpClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public OpenAiProvider(String apiKey, String baseUrl, String model) {
        this.apiKey   = apiKey;
        this.endpoint = baseUrl.replaceAll("/+$", "") + "/chat/completions";
        this.model    = model;
        this.http     = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String complete(List<Map<String, String>> messages) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", model);
        ArrayNode msgsNode = body.putArray("messages");
        for (Map<String, String> m : messages) {
            ObjectNode msg = msgsNode.addObject();
            msg.put("role",    m.get("role"));
            msg.put("content", m.get("content"));
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                // Reasoning models (e.g. GLM on NVIDIA NIM) can take minutes to answer
                .timeout(Duration.ofSeconds(300))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new RuntimeException("AI API error: " + res.statusCode() + " " + res.body());
        }

        JsonNode root = mapper.readTree(res.body());
        return root.at("/choices/0/message/content").asText();
    }
}
