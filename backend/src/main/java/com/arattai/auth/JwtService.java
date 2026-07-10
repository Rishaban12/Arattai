package com.arattai.auth;

import com.arattai.config.Env;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;

import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

public class JwtService {

    private static final JwtService INSTANCE = new JwtService();
    public static JwtService get() { return INSTANCE; }

    private static final long ACCESS_TTL_SECONDS = 604_800;       // 7 days

    private final Algorithm   algorithm;
    private final JWTVerifier verifier;

    private JwtService() {
        try {
            RSAPrivateKey privateKey = loadPrivate(Env.require("JWT_PRIVATE_KEY"));
            RSAPublicKey  publicKey  = loadPublic(Env.require("JWT_PUBLIC_KEY"));
            algorithm = Algorithm.RSA256(publicKey, privateKey);
            verifier  = JWT.require(algorithm).withIssuer("arattai").build();
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    public String issueAccess(long userId) {
        Instant now = Instant.now();
        return JWT.create()
                .withIssuer("arattai")
                .withSubject(String.valueOf(userId))
                .withIssuedAt(Date.from(now))
                .withExpiresAt(Date.from(now.plusSeconds(ACCESS_TTL_SECONDS)))
                .sign(algorithm);
    }

    public DecodedJWT verify(String token) {
        return verifier.verify(token);   // throws JWTVerificationException on failure
    }

    // ── PEM loading ─────────────────────────────────────────────────────────

    private static RSAPrivateKey loadPrivate(String pem) throws Exception {
        byte[] der = pemDer(pem);
        return (RSAPrivateKey) KeyFactory.getInstance("RSA")
                .generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private static RSAPublicKey loadPublic(String pem) throws Exception {
        byte[] der = pemDer(pem);
        return (RSAPublicKey) KeyFactory.getInstance("RSA")
                .generatePublic(new X509EncodedKeySpec(der));
    }

    private static byte[] pemDer(String pem) {
        String stripped = pem.replaceAll("-----[^-]+-----", "").replaceAll("\\s+", "");
        return Base64.getDecoder().decode(stripped);
    }
}