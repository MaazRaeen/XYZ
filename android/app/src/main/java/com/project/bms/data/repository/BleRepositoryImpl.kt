package com.project.bms.data.repository

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Log
import androidx.core.content.ContextCompat
import com.project.bms.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BleRepositoryImpl @Inject constructor(
    private val context: Context
) : BleRepository {

    companion object {
        private const val TAG = "BleRepository"

        // GATT UUID targets matching core BMS hardware specifications
        val SERVICE_UUID: UUID = UUID.fromString("0000FF00-0000-1000-8000-00805F9B34FB")
        val CHAR_TELEMETRY_UUID: UUID = UUID.fromString("0000FF01-0000-1000-8000-00805F9B34FB")
        val CHAR_CELLS_UUID: UUID = UUID.fromString("0000FF02-0000-1000-8000-00805F9B34FB")
        val CHAR_CONTROL_UUID: UUID = UUID.fromString("0000FF03-0000-1000-8000-00805F9B34FB")
        
        val CLIENT_CONFIG_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }

    private val bluetoothManager: BluetoothManager? by lazy {
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        bluetoothManager?.adapter
    }

    private val bluetoothLeScanner by lazy {
        bluetoothAdapter?.bluetoothLeScanner
    }

    private var bluetoothGatt: BluetoothGatt? = null
    
    private val _scanResults = MutableStateFlow<List<BleScanResult>>(emptyList())
    override val scanResults: StateFlow<List<BleScanResult>> = _scanResults.asStateFlow()

    private val _connectionState = MutableStateFlow(BleConnectionState.DISCONNECTED)
    override val connectionState: StateFlow<BleConnectionState> = _connectionState.asStateFlow()

    private val _liveTelemetry = MutableStateFlow<BmsTelemetry?>(null)
    override val liveTelemetry: StateFlow<BmsTelemetry?> = _liveTelemetry.asStateFlow()

    private var tempPackVoltage = 0.0
    private var tempCurrent = 0.0
    private var tempTemperature = 0.0
    private var tempStateOfCharge = 0.0
    private var tempCellVoltages = emptyList<Double>()

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
                val scanResult = BleScanResult(
                    deviceName = device.name,
                    deviceAddress = device.address,
                    rssi = result.rssi
                )
                val currentList = _scanResults.value
                if (currentList.none { it.deviceAddress == scanResult.deviceAddress }) {
                    _scanResults.value = currentList + scanResult
                }
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan failed: $errorCode")
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                when (newState) {
                    BluetoothProfile.STATE_CONNECTED -> {
                        _connectionState.value = BleConnectionState.CONNECTED
                        Log.d(TAG, "Connected to GATT server. Initiating Service Discovery...")
                        if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
                            gatt.discoverServices()
                        }
                    }
                    BluetoothProfile.STATE_DISCONNECTED -> {
                        _connectionState.value = BleConnectionState.DISCONNECTED
                        Log.d(TAG, "Disconnected from GATT server.")
                        cleanGatt()
                    }
                }
            } else {
                Log.e(TAG, "GATT connection operation failed with status code: $status")
                _connectionState.value = BleConnectionState.DISCONNECTED
                cleanGatt()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                val service = gatt.getService(SERVICE_UUID)
                if (service != null) {
                    _connectionState.value = BleConnectionState.READY
                    Log.d(TAG, "BMS Custom GATT Service located successfully.")
                    // Automatically enable notification loops on telemetry characteristics
                    val telemetryChar = service.getCharacteristic(CHAR_TELEMETRY_UUID)
                    if (telemetryChar != null) {
                        enableNotifications(gatt, telemetryChar)
                    }
                } else {
                    Log.e(TAG, "Target BMS GATT Service is missing on hardware device.")
                    disconnect()
                }
            } else {
                Log.e(TAG, "GATT Service discovery failed with status $status")
            }
        }

        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            parseCharacteristicData(characteristic)
        }

        override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                parseCharacteristicData(characteristic)
            }
        }

        override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "GATT Control Characteristic command write confirmed: ${characteristic.uuid}")
            } else {
                Log.e(TAG, "GATT Control Characteristic write failed: status $status")
            }
        }
    }

    override fun startScanning() {
        if (!hasPermission(Manifest.permission.BLUETOOTH_SCAN) || !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            Log.e(TAG, "Bluetooth scanning requires runtime permissions scan/connect.")
            return
        }

        _scanResults.value = emptyList()

        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        bluetoothLeScanner?.startScan(listOf(filter), settings, scanCallback)
        Log.d(TAG, "BLE Scan initiated, scanning for service: $SERVICE_UUID")
    }

    override fun stopScanning() {
        if (hasPermission(Manifest.permission.BLUETOOTH_SCAN)) {
            bluetoothLeScanner?.stopScan(scanCallback)
            Log.d(TAG, "BLE Scan stopped.")
        }
    }

    override fun connect(deviceAddress: String) {
        if (!hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            Log.e(TAG, "GATT client connection requires Bluetooth Connect permissions.")
            return
        }

        val device = bluetoothAdapter?.getRemoteDevice(deviceAddress)
        if (device == null) {
            Log.e(TAG, "Device profile not found for address: $deviceAddress")
            return
        }

        disconnect()
        _connectionState.value = BleConnectionState.CONNECTING
        bluetoothGatt = device.connectGatt(context, false, gattCallback)
    }

    override fun disconnect() {
        if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            bluetoothGatt?.disconnect()
        }
    }

    override suspend fun sendCommand(command: BmsCommand): Result<Unit> {
        val gatt = bluetoothGatt
        if (gatt == null || _connectionState.value != BleConnectionState.READY) {
            return Result.failure(Exception("BMS target is not connected or ready for GATT requests."))
        }

        val service = gatt.getService(SERVICE_UUID) ?: return Result.failure(Exception("BMS Service not discovered."))
        val controlChar = service.getCharacteristic(CHAR_CONTROL_UUID) ?: return Result.failure(Exception("Control characteristic not discovered."))

        val payload = when (command) {
            is BmsCommand.StartCharging -> byteArrayOf(0x01)
            is BmsCommand.StopCharging -> byteArrayOf(0x02)
            is BmsCommand.SetChargeCurrentLimit -> byteArrayOf(0x03, command.limitAmps.toByte())
        }

        controlChar.value = payload
        controlChar.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT

        return if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            val success = gatt.writeCharacteristic(controlChar)
            if (success) Result.success(Unit) else Result.failure(Exception("Failed to request GATT characteristic write."))
        } else {
            Result.failure(Exception("Missing BLUETOOTH_CONNECT permission to execute write."))
        }
    }

    private fun enableNotifications(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        if (!hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) return
        
        gatt.setCharacteristicNotification(characteristic, true)
        val descriptor = characteristic.getDescriptor(CLIENT_CONFIG_DESCRIPTOR_UUID)
        if (descriptor != null) {
            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt.writeDescriptor(descriptor)
            Log.d(TAG, "Notifications enabled for UUID: ${characteristic.uuid}")
        }
    }

    private fun parseCharacteristicData(characteristic: BluetoothGattCharacteristic) {
        val data = characteristic.value ?: return
        when (characteristic.uuid) {
            CHAR_TELEMETRY_UUID -> {
                // Parse Telemetry packet payload (6 bytes)
                if (data.size >= 6) {
                    val buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
                    
                    // Pack Voltage: 16-bit unsigned (scale 0.01V)
                    val rawVoltage = buffer.short.toInt() and 0xFFFF
                    tempPackVoltage = rawVoltage * 0.01

                    // Current: 16-bit signed (scale 0.01A)
                    val rawCurrent = buffer.short.toInt()
                    tempCurrent = rawCurrent * 0.01

                    // Temperature: 8-bit signed (offset -40C)
                    val rawTemp = buffer.get().toInt()
                    tempTemperature = (rawTemp - 40).toDouble()

                    // SoC: 8-bit unsigned
                    val rawSoc = buffer.get().toInt() and 0xFF
                    tempStateOfCharge = rawSoc.toDouble()

                    updateLiveTelemetry()
                    Log.d(TAG, "GATT Telemetry Parsed: ${tempPackVoltage}V, ${tempCurrent}A, ${tempTemperature}C, SoC: ${tempStateOfCharge}%")
                }
            }
            CHAR_CELLS_UUID -> {
                // Parse Cell Voltages packet payload (16 bytes, 8 cells * 16-bit scale 0.001V)
                if (data.size >= 16) {
                    val buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
                    val cellList = mutableListOf<Double>()
                    for (i in 0 until 8) {
                        val rawVolts = buffer.short.toInt() and 0xFFFF
                        cellList.add(rawVolts * 0.001)
                    }
                    tempCellVoltages = cellList
                    updateLiveTelemetry()
                    Log.d(TAG, "GATT Cell Voltages Parsed: $tempCellVoltages")
                }
            }
        }
    }

    private fun updateLiveTelemetry() {
        _liveTelemetry.value = BmsTelemetry(
            packVoltage = tempPackVoltage,
            current = tempCurrent,
            temperature = tempTemperature,
            stateOfCharge = tempStateOfCharge,
            cellVoltages = tempCellVoltages
        )
    }

    private fun cleanGatt() {
        if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            bluetoothGatt?.close()
        }
        bluetoothGatt = null
        _liveTelemetry.value = null
    }

    private fun hasPermission(permission: String): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }
}
