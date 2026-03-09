package com.example.demo.presentation.controller;

import com.example.demo.application.dto.response.AuthResponse;
import com.example.demo.application.dto.request.VerifySignatureRequest;
import com.example.demo.application.dto.request.WalletRequest;
import com.example.demo.application.service.AuthApplicationService;
import com.example.demo.domain.repository.UserRepository;
import com.example.demo.infrastructure.persistence.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final AuthApplicationService verifier;

    @PostMapping("/nonce")
    public String getNonce(@RequestBody WalletRequest request) {

        String wallet = request.getWalletAddress();

        User user = userRepository.findByWalletAddress(wallet)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setWalletAddress(wallet);
                    return newUser;
                });

        String nonce = UUID.randomUUID().toString();

        user.setNonce(nonce);
        userRepository.save(user);

        return nonce;
    }
    @PostMapping("/verify")
    public AuthResponse verify(@RequestBody VerifySignatureRequest request){
        AuthResponse aa = verifier.verifySignature(request);
        return  aa;
    }
}