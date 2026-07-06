package com.arattai.auth;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.websocket.HandshakeResponse;
import jakarta.websocket.server.HandshakeRequest;
import jakarta.websocket.server.ServerEndpointConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * Validates the JWT before the WebSocket connection opens.
 *
 * Token resolution order:
 *   1. access_token HttpOnly cookie (sent automatically by the browser)
 *   2. ?token= query parameter (fallback for non-browser / test clients)
 *
 * Sets "userId" in user properties so ChatSocket can read it in onOpen.
 */
public class WsHandshakeAuth extends ServerEndpointConfig.Configurator {

    private static final Logger log = LoggerFactory.getLogger(WsHandshakeAuth.class);

    @Override
    public void modifyHandshake(ServerEndpointConfig config,
                                HandshakeRequest request,
                                HandshakeResponse response) {

        String token = null;

        // 1. Cookie (preferred — HttpOnly, not visible to JS)
        Map<String, List<String>> headers = request.getHeaders();
        List<String> cookieHeaders = headers.get("cookie");
        if (cookieHeaders != null) {
            for (String header : cookieHeaders) {
                String found = CookieHelper.parseCookieHeader(header, CookieHelper.ACCESS_COOKIE);
                if (found != null) { token = found; break; }
            }
        }

        // 2. ?token= query param (fallback)
        if (token == null) {
            Map<String, List<String>> params = request.getParameterMap();
            List<String> tokens = params.get("token");
            if (tokens != null && !tokens.isEmpty()) {
                token = tokens.get(0);
            }
        }

        if (token == null) {
            log.warn("WS connect rejected: no token");
            return;
        }

        try {
            DecodedJWT jwt = JwtService.get().verify(token);
            long userId = Long.parseLong(jwt.getSubject());
            config.getUserProperties().put("userId", userId);
        } catch (JWTVerificationException e) {
            log.warn("WS connect rejected: {}", e.getMessage());
            // userId not set → ChatSocket.onOpen will close the session
        }
    }
}
