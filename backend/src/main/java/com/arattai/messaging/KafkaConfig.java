package com.arattai.messaging;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;

public final class KafkaConfig {

    private KafkaConfig() {}

    /** Base properties shared by producer and all consumers. Adds SASL/SSL when env vars are present. */
    public static Properties base() {
        String bootstrap = System.getenv().getOrDefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092");
        String username  = System.getenv("KAFKA_SASL_USERNAME");
        String password  = System.getenv("KAFKA_SASL_PASSWORD");

        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);

        if (username != null && !username.isEmpty()) {
            String mechanism = System.getenv().getOrDefault("KAFKA_SASL_MECHANISM", "PLAIN");
            String loginModule = mechanism.equals("PLAIN")
                    ? "org.apache.kafka.common.security.plain.PlainLoginModule"
                    : "org.apache.kafka.common.security.scram.ScramLoginModule";
            props.put("security.protocol", "SASL_SSL");
            props.put("sasl.mechanism",    mechanism);
            props.put("sasl.jaas.config",  loginModule + " required " +
                    "username=\"" + username + "\" password=\"" + password + "\";");

            // Aiven (and some other providers) require a custom CA cert
            String caCert = System.getenv("KAFKA_SSL_CA_CERT");
            if (caCert != null && !caCert.isEmpty()) {
                props.put("ssl.truststore.type",         "PEM");
                props.put("ssl.truststore.certificates", caCert.replace("\\n", "\n"));
            }
        }

        return props;
    }

    public static Properties producer() {
        Properties props = base();
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,   StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG,    "1");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        return props;
    }

    public static Properties consumer(String groupId) {
        Properties props = base();
        props.put(ConsumerConfig.GROUP_ID_CONFIG,                    groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG,      StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG,    StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG,           "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG,          "true");
        return props;
    }
}
