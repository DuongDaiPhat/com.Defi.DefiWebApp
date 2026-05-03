package com.example.demo.application.dto.response;

import lombok.Data;

@Data
public class JWTResponse {
    String token;
    public JWTResponse(String token){
        this.token = token;
    };
}
