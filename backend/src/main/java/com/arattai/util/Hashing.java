package com.arattai.util;

import at.favre.lib.crypto.bcrypt.BCrypt;

public final class Hashing {

    private Hashing() {}

    private static final int COST = 12;

    public static String bcrypt(String plain) {
        return BCrypt.withDefaults().hashToString(COST, plain.toCharArray());
    }

    public static boolean bcryptVerify(String plain, String hash) {
        return BCrypt.verifyer().verify(plain.toCharArray(), hash).verified;
    }
}