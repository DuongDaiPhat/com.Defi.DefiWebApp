package com.example.demo.presentation.controller;

import com.example.demo.application.dto.request.WalletRequest;
import com.example.demo.domain.repository.UserRepository;
import com.example.demo.infrastructure.persistence.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;

    @PostMapping("/nonce")
    public String getNonce(@RequestBody WalletRequest request) {

        String originalWallet = request.getWalletAddress();
        if (originalWallet == null || originalWallet.trim().isEmpty()) {
            throw new IllegalArgumentException("Wallet address is required");
        }
        final String wallet = originalWallet.toLowerCase();

        User user;
        try {
            user = userRepository.findByWalletAddress(wallet)
                    .orElseGet(() -> {
                        User newUser = new User();
                        newUser.setWalletAddress(wallet);
                        return newUser;
                    });

            String nonce = UUID.randomUUID().toString();
            user.setNonce(nonce);
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            // Handle race condition: If another thread inserted the user concurrently,
            // fetch it
            user = userRepository.findByWalletAddress(wallet)
                    .orElseThrow(() -> new RuntimeException("Error fetching concurrent user creation"));
            String nonce = UUID.randomUUID().toString();
            user.setNonce(nonce);
            user = userRepository.save(user);
        }

        return user.getNonce();
    }
}