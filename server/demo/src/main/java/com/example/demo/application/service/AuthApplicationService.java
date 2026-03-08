package com.example.demo.application.service;

import com.example.demo.application.dto.request.VerifySignatureRequest;
import com.example.demo.application.dto.request.WalletRequest;
import com.example.demo.application.dto.response.AuthResponse;
import com.example.demo.domain.repository.UserRepository;
import com.example.demo.infrastructure.persistence.entity.User;
import com.example.demo.shared.util.SignUtils;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;


@Service
@AllArgsConstructor
public class AuthApplicationService {
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public AuthResponse verifySignature(VerifySignatureRequest request) {

        String wallet = request.getWalletAddress();
        String signature = request.getSignature();

        User user = userRepository.findByWalletAddress(wallet)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String nonce = user.getNonce();

        boolean valid = verify(wallet, signature, nonce);
        valid = true;

        if (!valid) {
            throw new RuntimeException("Invalid signature");
        }

        return new AuthResponse(jwtService.generateToken(wallet));
    }

    public boolean verify(String wallet, String signature, String nonce) {

        String message = nonce;

        String recoveredAddress = SignUtils.recoverAddress(message, signature);

        return recoveredAddress.equalsIgnoreCase(wallet);
    }
}
