package com.project.bms.data.repository

import com.project.bms.data.model.AuthResponse
import com.project.bms.data.model.LoginRequest
import com.project.bms.data.model.RegisterRequest
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    suspend fun login(request: LoginRequest): Result<AuthResponse>
    suspend fun register(request: RegisterRequest): Result<AuthResponse>
    val isUserLoggedIn: Flow<Boolean>
    suspend fun forgotPassword(email: String): Result<String>
    suspend fun logout(): Result<Unit>
}
