package com.project.bms.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.project.bms.data.model.BleConnectionState
import com.project.bms.data.model.BmsCommand
import com.project.bms.data.model.BmsTelemetry
import com.project.bms.data.repository.BatteryRepository
import com.project.bms.data.repository.BleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import kotlin.math.abs

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val bleRepository: BleRepository,
    private val batteryRepository: BatteryRepository
) : ViewModel() {

    // Default provisioned local device ID
    private val deviceId = "6a47ba18a6ddbf5bf4fb0f99"
    private val batteryCapacityAh = 100.0 // 100Ah nominal capacity representation

    // Expose BLE states directly to the UI
    val connectionState = bleRepository.connectionState
    val liveTelemetry = bleRepository.liveTelemetry

    private val _chartPoints = MutableStateFlow<List<Pair<Long, Double>>>(emptyList())
    val chartPoints: StateFlow<List<Pair<Long, Double>>> = _chartPoints.asStateFlow()

    private val _isPowerOutputActive = MutableStateFlow(true)
    val isPowerOutputActive: StateFlow<Boolean> = _isPowerOutputActive.asStateFlow()

    private val _chargingStatus = MutableStateFlow("Idle")
    val chargingStatus: StateFlow<String> = _chargingStatus.asStateFlow()

    private val _timeRemaining = MutableStateFlow("N/A")
    val timeRemaining: StateFlow<String> = _timeRemaining.asStateFlow()

    init {
        loadTelemetryHistory()
        observeLiveTelemetry()
    }

    private fun loadTelemetryHistory() {
        viewModelScope.launch {
            batteryRepository.getTelemetryHistory(deviceId).fold(
                onSuccess = { history ->
                    // Map DB history logs to timeline graph points (timestamp epoch -> voltage)
                    val points = history.map { log ->
                        val epoch = parseIsoTimestamp(log.timestamp)
                        Pair(epoch, log.voltage)
                    }.sortedBy { it.first }
                    _chartPoints.value = points
                },
                onFailure = {
                    // Fallback to empty list if network history fetch fails
                }
            )
        }
    }

    private fun observeLiveTelemetry() {
        viewModelScope.launch {
            liveTelemetry.collect { telemetry ->
                if (telemetry != null) {
                    // Append live telemetry voltage point
                    val currentEpoch = System.currentTimeMillis()
                    val updatedPoints = _chartPoints.value + Pair(currentEpoch, telemetry.packVoltage)
                    // Keep only last 50 readings to prevent memory fatigue
                    _chartPoints.value = updatedPoints.takeLast(50)

                    // Update charging details based on current sign (charging positive, discharging negative)
                    val current = telemetry.current
                    val soc = telemetry.stateOfCharge
                    
                    when {
                        current > 0.1 -> {
                            _chargingStatus.value = "Charging"
                            _isPowerOutputActive.value = true
                            calculateTimeRemaining(current, soc, isCharging = true)
                        }
                        current < -0.1 -> {
                            _chargingStatus.value = "Discharging"
                            _isPowerOutputActive.value = true
                            calculateTimeRemaining(current, soc, isCharging = false)
                        }
                        else -> {
                            _chargingStatus.value = "Idle"
                            _timeRemaining.value = "Fully Charged"
                        }
                    }
                }
            }
        }
    }

    private fun calculateTimeRemaining(current: Double, soc: Double, isCharging: Boolean) {
        val currentAbs = abs(current)
        if (currentAbs < 0.05) {
            _timeRemaining.value = "N/A"
            return
        }

        val remainingHours = if (isCharging) {
            // Hours remaining to reach 100% SoC
            val remainingCapacityAh = (100.0 - soc) * 0.01 * batteryCapacityAh
            remainingCapacityAh / currentAbs
        } else {
            // Hours remaining until depletion (0% SoC)
            val availableCapacityAh = soc * 0.01 * batteryCapacityAh
            availableCapacityAh / currentAbs
        }

        val hours = remainingHours.toInt()
        val minutes = ((remainingHours - hours) * 60).toInt()

        _timeRemaining.value = when {
            hours > 0 -> "${hours}h ${minutes}m"
            else -> "${minutes}m"
        }
    }

    fun togglePowerOutput(enabled: Boolean) {
        viewModelScope.launch {
            val command = if (enabled) BmsCommand.StartCharging else BmsCommand.StopCharging
            val result = bleRepository.sendCommand(command)
            result.fold(
                onSuccess = {
                    _isPowerOutputActive.value = enabled
                    if (!enabled) {
                        _chargingStatus.value = "Idle"
                        _timeRemaining.value = "Disabled"
                    }
                },
                onFailure = {
                    // Log command failures
                }
            )
        }
    }

    private fun parseIsoTimestamp(isoString: String): Long {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            sdf.parse(isoString)?.time ?: System.currentTimeMillis()
        } catch (e: Exception) {
            System.currentTimeMillis()
        }
    }
}
