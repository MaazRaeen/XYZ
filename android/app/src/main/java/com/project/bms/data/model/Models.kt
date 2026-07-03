package com.project.bms.data.model

// User Entities
data class User(
    val _id: String,
    val name: String,
    val email: String,
    val role: String
)

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class AuthResponse(
    val success: Boolean,
    val data: AuthData
)

data class AuthData(
    val accessToken: String,
    val user: User
)

// Device Entities
data class Device(
    val _id: String,
    val deviceId: String,
    val name: String,
    val connectionType: String,
    val status: String,
    val lastSeen: String
)

data class DeviceRequest(
    val deviceId: String,
    val name: String,
    val connectionType: String
)

// Telemetry Entities
data class TelemetryRequest(
    val voltage: Double,
    val current: Double,
    val temperature: Double,
    val stateOfCharge: Double,
    val timestamp: String? = null
)
