package com.example.demo.domain.repository;

public interface SignatureVerifier {
    boolean verifySignature(String wallet, String nonce, String signature);
}
