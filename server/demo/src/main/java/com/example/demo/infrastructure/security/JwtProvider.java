//package com.example.demo.infrastructure.security;
//
//import lombok.Value;
//import org.springframework.stereotype.Component;
//import org.web3j.crypto.Keys;
//
//import java.util.Date;
//
//@Component
//public class JwtProvider {
//
//    @Value("${jwt.secret}")
//    private String secret;
//
//    public String generateToken(String walletAddress) {
//
//        return Jwts.builder()
//                .setSubject(walletAddress)
//                .setIssuedAt(new Date())
//                .setExpiration(new Date(System.currentTimeMillis() + 86400000))
//                .signWith(Keys.hmacShaKeyFor(secret.getBytes()))
//                .compact();
//    }
//}