package com.example.demo.shared.util;

import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.SignatureException;

public class SignUtils {

    public static String recoverAddress(String message, String signature) {
        try {
            byte[] msgHash = Sign.getEthereumMessageHash(
                    message.getBytes(StandardCharsets.UTF_8)
            );

            Sign.SignatureData signatureData = signatureStringToData(signature);

            BigInteger publicKey = Sign.signedMessageToKey(msgHash, signatureData);

            return "0x" + Keys.getAddress(publicKey);

        } catch (SignatureException e) {
            throw new RuntimeException("Invalid signature", e);
        }
    }

    private static Sign.SignatureData signatureStringToData(String signature) {

        byte[] sigBytes = Numeric.hexStringToByteArray(signature);

        byte v = sigBytes[64];
        byte[] r = new byte[32];
        byte[] s = new byte[32];

        System.arraycopy(sigBytes, 0, r, 0, 32);
        System.arraycopy(sigBytes, 32, s, 0, 32);

        return new Sign.SignatureData(v, r, s);
    }
}