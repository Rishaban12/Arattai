package com.arattai.config;

import com.arattai.ai.AiProvider;
import com.arattai.ai.ClaudeProvider;
import com.arattai.ai.OpenAiProvider;
import com.arattai.cache.RedisClient;
import com.arattai.messaging.AiConsumer;
import com.arattai.messaging.InboxConsumer;
import com.arattai.messaging.KafkaProducerService;
import com.arattai.messaging.NotifyConsumer;
import com.arattai.messaging.PersistConsumer;
import com.arattai.realtime.FanoutService;
import com.datastax.oss.driver.api.core.CqlSession;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class AppBootstrapListener implements ServletContextListener {

    private static final Logger log = LoggerFactory.getLogger(AppBootstrapListener.class);

    /** Populated from .env on startup; falls back to real env vars in env(). */
    private static final Map<String, String> dotenv = new HashMap<>();

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        log.info("Arattai backend starting up...");
        loadDotEnv();
        Env.load(dotenv); // make .env values available to all singletons via Env.get()

        HikariDataSource    ds       = initMysql();
        CqlSession          cassandra = initCassandra();
        RedisClient         redis    = initRedis();
        KafkaProducerService kafka   = new KafkaProducerService();
        AiProvider          ai       = initAiProvider();

        AppConfig cfg = new AppConfig(ds, cassandra, redis, kafka, ai);
        AppConfig.set(cfg);

        // Subscribe to cross-instance fan-out channel on every node
        FanoutService.startSubscriber(redis);

        // Start Kafka consumers in background threads
        new Thread(new PersistConsumer(),  "kafka-persist").start();
        new Thread(new InboxConsumer(),    "kafka-inbox").start();
        new Thread(new NotifyConsumer(),   "kafka-notify").start();
        new Thread(new AiConsumer(),       "kafka-ai").start();

        log.info("Arattai backend started.");
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        log.info("Arattai backend shutting down...");
        try { AppConfig.get().close(); } catch (Exception e) { log.warn("Shutdown error", e); }
    }

    // ── Init helpers ────────────────────────────────────────────────────────

    private HikariDataSource initMysql() {
        HikariConfig hc = new HikariConfig();
        hc.setJdbcUrl(env("DB_URL"));
        hc.setUsername(env("DB_USER"));
        hc.setPassword(Env.getOrDefault("DB_PASS", ""));
        hc.setMaximumPoolSize(20);
        hc.setMinimumIdle(5);
        hc.setConnectionTimeout(3000);
        hc.setPoolName("arattai-mysql");
        return new HikariDataSource(hc);
    }

    private CqlSession initCassandra() {
        String contactPoints = env("CASSANDRA_CONTACT_POINTS");
        String keyspace      = env("CASSANDRA_KEYSPACE");

        return CqlSession.builder()
                .addContactPoints(Arrays.stream(contactPoints.split(","))
                        .map(String::trim)
                        .map(h -> InetSocketAddress.createUnresolved(h, 9042))
                        .toList())
                .withLocalDatacenter("datacenter1")
                .withKeyspace(keyspace)
                .build();
    }

    private RedisClient initRedis() {
        return new RedisClient(env("REDIS_URL"));
    }

    private AiProvider initAiProvider() {
        String provider = Env.getOrDefault("AI_PROVIDER", "openai");
        String apiKey   = env("AI_API_KEY");
        return switch (provider.toLowerCase()) {
            case "claude" -> new ClaudeProvider(apiKey);
            default       -> new OpenAiProvider(apiKey);
        };
    }

    private String env(String key) {
        return Env.require(key);
    }

    private void loadDotEnv() {
        // Search for .env in the working dir and its parent (covers IDE and WAR deployments)
        String[] candidates = {
            System.getProperty("user.dir") + "/.env",
            System.getProperty("user.dir") + "/../.env",
            System.getProperty("user.dir") + "/../../.env",
        };
        for (String path : candidates) {
            File f = new File(path);
            if (!f.exists()) continue;
            try {
                for (String line : Files.readAllLines(f.toPath())) {
                    line = line.strip();
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    int eq = line.indexOf('=');
                    if (eq < 1) continue;
                    String k = line.substring(0, eq).strip();
                    String v = line.substring(eq + 1).strip();
                    dotenv.put(k, v);
                }
                log.info("Loaded .env from {}", f.getAbsolutePath());
                return;
            } catch (IOException e) {
                log.warn("Failed to read .env at {}: {}", path, e.getMessage());
            }
        }
        log.warn(".env file not found — relying on real environment variables");
    }
}