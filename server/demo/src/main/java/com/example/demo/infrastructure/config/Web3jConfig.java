package com.example.demo.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

@Configuration
public class Web3jConfig {

    @Value("${web3j.client-address}")
    private String rpcUrl;

    @Bean
    public Web3j web3j() {
        // Bản Core 5.0.2 khởi tạo cực kỳ đơn giản như thế này:
        return Web3j.build(new HttpService(rpcUrl));
    }
}