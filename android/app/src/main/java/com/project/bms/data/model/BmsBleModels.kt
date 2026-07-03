package com.project.bms.data.model

enum class BleConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    READY
}

data class BleScanResult(
    val deviceName: String?,
    val deviceAddress: String,
    val rssi: Int
)

data class BmsTelemetry(
    val packVoltage: Double,
    val current: Double,
    val temperature: Double,
    val stateOfCharge: Double,
    val cellVoltages: List<Double>
)

sealed interface BmsCommand {
    object StartCharging : BmsCommand
    object StopCharging : BmsCommand
    data class SetChargeCurrentLimit(val limitAmps: Int) : BmsCommand
}
