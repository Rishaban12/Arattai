package com.arattai.util;

import com.datastax.oss.driver.api.core.uuid.Uuids;

import java.util.UUID;

public final class TimeUUID {

    private TimeUUID() {}

    /** Generate a time-based UUID (v1) — monotonically ordered for Cassandra clustering. */
    public static UUID generate() {
        return Uuids.timeBased();
    }

    /** Convert a timeuuid string back to UUID. */
    public static UUID fromString(String s) {
        return UUID.fromString(s);
    }
}