package com.arattai.messaging;

import com.arattai.util.Json;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


public class KafkaProducerService implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(KafkaProducerService.class);

    public static final String TOPIC_MESSAGES      = "chat.messages";
    public static final String TOPIC_NOTIFICATIONS = "chat.notifications";
    public static final String TOPIC_AI_REQUESTS   = "chat.ai.requests";
    public static final String TOPIC_AI_RESPONSES  = "chat.ai.responses";
    public static final String TOPIC_ANALYTICS     = "chat.analytics";

    private final KafkaProducer<String, String> producer;

    public KafkaProducerService() {
        this.producer = new KafkaProducer<>(KafkaConfig.producer());
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
