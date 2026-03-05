//package com.example.demo.application.usecase;
//
//import com.example.demo.application.dto.AuthResponse;
//import com.example.demo.infrastructure.persistence.entity.User;
//import com.example.demo.domain.repository.UserRepository;
//import com.example.demo.domain.repository.SignatureVerifier;
//import com.example.demo.infrastructure.security.JwtProvider;
//import lombok.RequiredArgsConstructor;
//import org.springframework.stereotype.Service;
//
//import java.util.UUID;
//
//@Service
//@RequiredArgsConstructor
//public class VerifySignatureUseCase {
//
//    private final UserRepository userRepository;
//    private final SignatureVerifier signatureVerifier;
//    private final JwtProvider jwtProvider;
//
//    public AuthResponse execute(String walletAddress, String signature) {
//
//        User user = userRepository.findByWalletAddress(walletAddress)
//                .orElseThrow(() -> new RuntimeException("User not found"));
//
//        boolean isValid = signatureVerifier.verify(
//                walletAddress,
//                signature,
//                user.getNonce()
//        );
//
//        if (!isValid) {
//            throw new RuntimeException("Invalid signature");
//        }
//
//        // Reset nonce để chống replay
//        user.setNonce(UUID.randomUUID().toString());
//        userRepository.save(user);
//
//        String token = jwtProvider.generateToken(walletAddress);
//
//        return new AuthResponse(token);
//    }
//}