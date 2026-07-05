package com.arattai.config;

import com.arattai.ai.AiProvider;
import com.arattai.cache.RedisClient;
import com.arattai.messaging.KafkaProducerService;
import com.arattai.repo.cassandra.ConversationDao;
import com.arattai.repo.cassandra.MessageDao;
import com.arattai.repo.cassandra.ReadStateDao;
import com.arattai.repo.mysql.GroupDao;
import com.arattai.repo.mysql.UserDao;
import com.datastax.oss.driver.api.core.CqlSession;
import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;

public final class AppConfig {

    private static volatile AppConfig instance;

    private final HikariDataSource dataSource;
    private final CqlSession        cassandraSession;
    private final RedisClient        redisClient;
    private final KafkaProducerService kafkaProducer;

    // DAOs / services built once and reused
    private final UserDao         userDao;
    private final GroupDao        groupDao;
    private final MessageDao      messageDao;
    private final ConversationDao conversationDao;
    private final ReadStateDao    readStateDao;
    private final AiProvider      aiProvider;

    AppConfig(HikariDataSource dataSource,
              CqlSession cassandraSession,
              RedisClient redisClient,
              KafkaProducerService kafkaProducer,
              AiProvider aiProvider) {
        this.dataSource       = dataSource;
        this.cassandraSession = cassandraSession;
        this.redisClient      = redisClient;
        this.kafkaProducer    = kafkaProducer;
        this.aiProvider       = aiProvider;

        this.userDao         = new UserDao(dataSource);
        this.groupDao        = new GroupDao(dataSource);
        this.messageDao      = new MessageDao(cassandraSession);
        this.conversationDao = new ConversationDao(cassandraSession);
        this.readStateDao    = new ReadStateDao(cassandraSession);
    }

    public static AppConfig get() {
        if (instance == null) throw new IllegalStateException("AppConfig not initialised");
        return instance;
    }

    static void set(AppConfig cfg) {
        instance = cfg;
    }

    public DataSource        getDataSource()       { return dataSource; }
    public CqlSession        getCassandraSession() { return cassandraSession; }
    public RedisClient       getRedisClient()      { return redisClient; }
    public KafkaProducerService getKafkaProducer() { return kafkaProducer; }
    public UserDao           getUserDao()          { return userDao; }
    public GroupDao          getGroupDao()         { return groupDao; }
    public MessageDao        getMessageDao()       { return messageDao; }
    public ConversationDao   getConversationDao()  { return conversationDao; }
    public ReadStateDao      getReadStateDao()     { return readStateDao; }
    public AiProvider        getAiProvider()       { return aiProvider; }

    public void close() {
        try { kafkaProducer.close(); }        catch (Exception ignored) {}
        try { redisClient.close(); }          catch (Exception ignored) {}
        try { cassandraSession.close(); }     catch (Exception ignored) {}
        try { dataSource.close(); }           catch (Exception ignored) {}
    }
}