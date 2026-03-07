package com.example.demo.application.usecase;

import com.example.demo.application.dto.NonceResponse;
import com.example.demo.infrastructure.persistence.entity.User;
import com.example.demo.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GenerateNonceUseCase {

    private final UserRepository userRepository;

    public NonceResponse execute(String walletAddress) {

        User user = userRepository.findByWalletAddress(walletAddress)
                .orElseGet(() -> userRepository.save(
                        User.create(walletAddress)
                ));

        String nonce = UUID.randomUUID().toString();
        user.setNonce(nonce);

        userRepository.save(user);

        return new NonceResponse(nonce);
    }
}