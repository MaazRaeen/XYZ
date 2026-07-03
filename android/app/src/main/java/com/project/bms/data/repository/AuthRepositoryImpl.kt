package com.project.bms.data.repository

import com.project.bms.data.local.TokenManager
import com.project.bms.data.model.AuthResponse
import com.project.bms.data.model.LoginRequest
import com.project.bms.data.model.RegisterRequest
import com.project.bms.data.remote.BmsApiService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class AuthRepositoryImpl @Inject constructor(
    private val apiService: BmsApiService,
    private val tokenManager: TokenManager
) : AuthRepository {

    override suspend fun login(request: LoginRequest): Result<AuthResponse> {
        return try {
            val response = apiService.login(request)
            if (response.isSuccessful && response.body() != null) {
                val authResponse = response.body()!!
                // Store JWT access token in DataStore locally
                tokenManager.saveTokens(authResponse.data.accessToken, "")
                Result.success(authResponse)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Authentication failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun register(request: RegisterRequest): Result<AuthResponse> {
        return try {
            val response = apiService.register(request)
            if (response.isSuccessful && response.body() != null) {
                val authResponse = response.body()!!
                tokenManager.saveTokens(authResponse.data.accessToken, "")
                Result.success(authResponse)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Registration failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override val isUserLoggedIn: Flow<Boolean> = tokenManager.accessToken.map { token ->
        !token.isNullOrBlank()
    }

    override suspend fun forgotPassword(email: String): Result<String> {
        return try {
            val response = apiService.forgotPassword(ForgotPasswordRequest(email))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.message)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Password reset request failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun logout(): Result<Unit> {
        return try {
            apiService.logout()
            tokenManager.clearTokens()
            Result.success(Unit)
        } catch (e: Exception) {
            // Guarantee local credentials purge even if endpoint fails or network drops
            tokenManager.clearTokens()
            Result.success(Unit)
        }
    }
}
