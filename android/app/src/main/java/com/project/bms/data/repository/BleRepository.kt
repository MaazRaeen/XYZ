package com.project.bms.data.repository

import com.project.bms.data.model.BleConnectionState
import com.project.bms.data.model.BleScanResult
import com.project.bms.data.model.BmsCommand
import com.project.bms.data.model.BmsTelemetry
import kotlinx.coroutines.flow.StateFlow

interface BleRepository {
    val scanResults: StateFlow<List<BleScanResult>>
    val connectionState: StateFlow<BleConnectionState>
    val liveTelemetry: StateFlow<BmsTelemetry?>
    
    fun startScanning()
    fun stopScanning()
    fun connect(deviceAddress: String)
    fun disconnect()
    suspend fun sendCommand(command: BmsCommand): Result<Unit>
}
