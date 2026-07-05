package com.arattai.realtime;

import java.util.List;

public class FanoutMsg {
    public List<Long> recipientIds;
    public String     payload;

    public FanoutMsg() {}

    public FanoutMsg(List<Long> recipientIds, String payload) {
        this.recipientIds = recipientIds;
        this.payload      = payload;
    }
}