package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.User;


import java.util.Optional;

public interface UserRepository {
    Optional<User> findByWalletAddress(String walletAddress);
    User save(User user);
}
