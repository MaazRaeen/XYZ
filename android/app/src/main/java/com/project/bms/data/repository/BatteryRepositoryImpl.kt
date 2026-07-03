package com.project.bms.data.repository

import com.project.bms.data.model.TelemetryLog
import com.project.bms.data.remote.BmsApiService
import javax.inject.Inject

class BatteryRepositoryImpl @Inject constructor(
    private val apiService: BmsApiService
) : BatteryRepository {

    override suspend fun getTelemetryHistory(deviceId: String): Result<List<TelemetryLog>> {
        return try {
            val response = apiService.getTelemetryHistory(deviceId)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to fetch telemetry history"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
