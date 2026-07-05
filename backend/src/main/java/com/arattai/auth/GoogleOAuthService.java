package com.arattai.auth;

import com.arattai.config.Env;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Handles all HTTP communication with Google's OAuth2 endpoints.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID       — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET   — from Google Cloud Console
 *   GOOGLE_REDIRECT_URI    — must match the Console setting, e.g. http://localhost:8080/api/auth/google/callback
 *   FRONTEND_URL           — where to send the browser after login, e.g. http://localhost:3000
 */
public class GoogleOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthService.class);

    private static final GoogleOAuthService INSTANCE = new GoogleOAuthService();
    public static GoogleOAuthService get() { return INSTANCE; }

    private static final String AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL    = "https://oauth2.googleapis.com/token";
    private static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final String frontendUrl;

    private final HttpClient    http   = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper  mapper = new ObjectMapper();

    private GoogleOAuthService() {
        clientId     = Env.get("GOOGLE_CLIENT_ID");
        clientSecret = Env.get("GOOGLE_CLIENT_SECRET");
        redirectUri  = Env.get("GOOGLE_REDIRECT_URI");
        frontendUrl  = Env.getOrDefault("FRONTEND_URL", "http://localhost:3000");
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank()
            && redirectUri != null && !redirectUri.isBlank();
    }

    public String getFrontendUrl() { return frontendUrl; }

    /** Builds the Google authorization URL the browser should be redirected to. */
    public String buildAuthUrl(String state) {
        return AUTH_URL
            + "?client_id="     + encode(clientId)
            + "&redirect_uri="  + encode(redirectUri)
            + "&response_type=code"
            + "&scope="         + encode("openid email profile")
            + "&access_type=offline"
            + "&state="         + encode(state);
    }

    /** Exchanges an authorization code for a Google access token. */
    public String exchangeCode(String code) throws Exception {
        String form = "code="          + encode(code)
                    + "&client_id="    + encode(clientId)
                    + "&client_secret="+ encode(clientSecret)
                    + "&redirect_uri=" + encode(redirectUri)
                    + "&grant_type=authorization_code";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .timeout(Duration.ofSeconds(15))
                .build();

        log.debug("[OAuth2] Exchanging authorization code for access token at {}", TOKEN_URL);
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            log.error("[OAuth2] Token exchange FAILED — HTTP {} body={}", res.statusCode(), res.body());
            throw new RuntimeException("Google token exchange failed: " + res.statusCode() + " " + res.body());
        }

        JsonNode json = mapper.readTree(res.body());
        log.info("[OAuth2] Token exchange SUCCESS — received access token from Google");
        return json.get("access_token").asText();
    }

    /** Fetches the authenticated user's profile from Google. */
    public GoogleUserInfo getUserInfo(String accessToken) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(USERINFO_URL))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();

        log.debug("[OAuth2] Fetching user profile from {}", USERINFO_URL);
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            log.error("[OAuth2] Userinfo fetch FAILED — HTTP {} body={}", res.statusCode(), res.body());
            throw new RuntimeException("Google userinfo failed: " + res.statusCode() + " " + res.body());
        }

        JsonNode json = mapper.readTree(res.body());
        log.info("[OAuth2] Userinfo SUCCESS — email={} name={}", json.path("email").asText(), json.path("name").asText());
        return new GoogleUserInfo(
            json.path("id").asText(),
            json.path("email").asText(),
            json.path("name").asText(),
            json.path("picture").asText(null)
        );
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    public record GoogleUserInfo(String id, String email, String name, String picture) {}
}