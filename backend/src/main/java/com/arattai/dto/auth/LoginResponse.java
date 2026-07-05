package com.arattai.dto.auth;

public class LoginResponse {
    public String accessToken;
    public String refreshToken;
    public long   userId;

    public LoginResponse(String accessToken, String refreshToken, long userId) {
        this.accessToken  = accessToken;
        this.refreshToken = refreshToken;
        this.userId       = userId;
    }
}