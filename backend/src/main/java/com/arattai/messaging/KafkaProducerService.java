package com.arattai.messaging;

import com.arattai.util.Json;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Properties;

public class KafkaProducerService implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(KafkaProducerService.class);

    public static final String TOPIC_MESSAGES      = "chat.messages";
    public static final String TOPIC_NOTIFICATIONS = "chat.notifications";
    public static final String TOPIC_AI_REQUESTS   = "chat.ai.requests";
    public static final String TOPIC_AI_RESPONSES  = "chat.ai.responses";
    public static final String TOPIC_ANALYTICS     = "chat.analytics";

    private final KafkaProducer<String, String> producer;

    public KafkaProducerService() {
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092");
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,   StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "1");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        this.producer = new KafkaProducer<>(props);
    }

    public void send(String topic, String key, Object value) {
        String json = Json.write(value);
        producer.send(new ProducerRecord<>(topic, key, json), (meta, ex) -> {
            if (ex != null) log.error("Kafka send failed topic={}", topic, ex);
        });
    }

    @Override
    public void close() {
        producer.flush();
        producer.close();
    }
}
