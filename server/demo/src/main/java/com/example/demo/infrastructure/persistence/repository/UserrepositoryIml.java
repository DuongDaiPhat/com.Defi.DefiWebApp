package com.example.demo.infrastructure.persistence.repository;

import com.example.demo.domain.repository.UserJpaRepository;
import com.example.demo.domain.repository.UserRepository;
import com.example.demo.infrastructure.persistence.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
@Repository
@RequiredArgsConstructor
public class UserrepositoryIml implements UserRepository {
    private final UserJpaRepository jpaRepository;

    @Override
    public Optional<User> findByWalletAddress(String walletAddress) {
        return jpaRepository.findByWalletAddress(walletAddress);
    }

    @Override
    public User save(User user) {
        return jpaRepository.save(user);
    }
}
