package com.project.bms.data.repository

import com.project.bms.data.model.TelemetryLog

interface BatteryRepository {
    suspend fun getTelemetryHistory(deviceId: String): Result<List<TelemetryLog>>
}
