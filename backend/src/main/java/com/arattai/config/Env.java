package com.arattai.config;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Shared environment accessor.
 *
 * AppBootstrapListener calls Env.load() once at startup with the parsed .env map.
 * Every other class calls Env.get() / Env.require() instead of System.getenv()
 * so that .env values are visible even when not set as real OS environment variables.
 *
 * Priority: real OS env var → .env file value.
 */
public final class Env {

    private Env() {}

    private static final Map<String, String> dotenv = new ConcurrentHashMap<>();

    /** Called once by AppBootstrapListener after reading the .env file. */
    static void load(Map<String, String> values) {
        dotenv.putAll(values);
    }

    /** Returns the value of key, or null if not set in either source. */
    public static String get(String key) {
        String v = System.getenv(key);
        if (v != null && !v.isBlank()) return v;
        return dotenv.get(key);
    }

    public static String getOrDefault(String key, String defaultValue) {
        String v = get(key);
        return (v != null && !v.isBlank()) ? v : defaultValue;
    }

    /** Like get(), but throws if the value is missing or blank. */
    public static String require(String key) {
        String v = get(key);
        if (v == null || v.isBlank()) {
            throw new IllegalStateException("Missing required env var: " + key);
        }
        return v;
    }
}