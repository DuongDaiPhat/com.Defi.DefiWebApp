package com.example.demo.infrastructure.persistence.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;

@Component
public class TestConnection implements CommandLineRunner {

    @Autowired
    private Web3j web3j;

    @Override
    public void run(String... args) throws Exception {
        try {
            String clientVersion = web3j.web3ClientVersion().send().getWeb3ClientVersion();
            System.out.println("===> KẾT NỐI SEPOLIA THÀNH CÔNG: " + clientVersion);
        } catch (Exception e) {
            System.err.println("===> LỖI KẾT NỐI: " + e.getMessage());
        }
    }
}