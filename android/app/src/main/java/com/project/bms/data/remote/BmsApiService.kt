package com.project.bms.data.remote

import com.project.bms.data.model.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface BmsApiService {

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/refresh-token")
    suspend fun refreshToken(): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("devices")
    suspend fun getDevices(): Response<List<Device>>

    @POST("devices")
    suspend fun registerDevice(@Body request: DeviceRequest): Response<Device>

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<MessageResponse>

    @POST("devices/{id}/telemetry")
    suspend fun uploadTelemetry(
        @Path("id") deviceId: String,
        @Body request: TelemetryRequest
    ): Response<Unit>
}
