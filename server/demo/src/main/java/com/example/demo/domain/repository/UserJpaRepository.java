package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<User, Long> {
    Optional<User> findByWalletAddress(String walletAddress);
}
