# REST API Specification (Express + MongoDB)
## Project: Battery Management System (BMS) API v1

---

## 1. Headers & Authentication Standards

All endpoints, except public authentication routes, require the following headers:

*   `Content-Type: application/json`
*   `Authorization: Bearer <jwt_access_token>`

Cookies are used to transport refresh tokens securely:
*   `Cookie: refreshToken=<jwt_refresh_token>` (HttpOnly, Secure, SameSite=Strict)

---

## 2. API Endpoints

### 2.1 Authentication Module

#### 2.1.1 Register User
*   **Method**: `POST`
*   **Route**: `/api/v1/auth/register`
*   **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "SecurePassword123",
      "firstName": "John",
      "lastName": "Doe"
    }
    ```
*   **Response Format** (`201 Created`):
    ```json
    {
      "success": true,
      "message": "User registered successfully.",
      "data": {
        "userId": "60d5ec49f1b29a1b18c5e001",
        "email": "user@example.com",
        "role": "user"
      }
    }
    ```
*   **Status Codes**:
    *   `201 Created`: Account successfully created.
    *   `400 Bad Request`: Validation failure (e.g. invalid email, short password).
    *   `409 Conflict`: Email already exists.

#### 2.1.2 Login User
*   **Method**: `POST`
*   **Route**: `/api/v1/auth/login`
*   **Request Body**:
    ```json
    {
      "email": "user@example.com",
      "password": "SecurePassword123"
    }
    ```
*   **Response Format** (`200 OK`):
    *   *Note: Sets cookie `refreshToken` on client.*
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOi...",
        "expiresIn": 900,
        "user": {
          "userId": "60d5ec49f1b29a1b18c5e001",
          "email": "user@example.com",
          "role": "user"
        }
      }
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Successful authentication.
    *   `400 Bad Request`: Missing credentials.
    *   `401 Unauthorized`: Invalid credentials.

#### 2.1.3 Refresh Token
*   **Method**: `POST`
*   **Route**: `/api/v1/auth/refresh`
*   **Request Body**: None (Reads cookie `refreshToken` automatically)
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOi...",
        "expiresIn": 900
      }
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Access token rotated.
    *   `401 Unauthorized`: Missing, expired, or invalid refresh token.

#### 2.1.4 Logout User
*   **Method**: `POST`
*   **Route**: `/api/v1/auth/logout`
*   **Request Body**: None
*   **Response Format** (`200 OK`):
    *   *Note: Clears the `refreshToken` cookie.*
    ```json
    {
      "success": true,
      "message": "Logged out successfully."
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Session cleared.

---

### 2.2 Users Module

#### 2.2.1 Get Current User Profile
*   **Method**: `GET`
*   **Route**: `/api/v1/users/me`
*   **Request Body**: None
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "userId": "60d5ec49f1b29a1b18c5e001",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "user",
        "createdAt": "2026-07-03T13:00:00Z"
      }
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Profile details retrieved.
    *   `401 Unauthorized`: Missing or invalid Bearer token.

#### 2.2.2 Update Profile Metadata
*   **Method**: `PUT`
*   **Route**: `/api/v1/users/me`
*   **Request Body**:
    ```json
    {
      "firstName": "Jonathan",
      "lastName": "Doel"
    }
    ```
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "userId": "60d5ec49f1b29a1b18c5e001",
        "email": "user@example.com",
        "firstName": "Jonathan",
        "lastName": "Doel"
      }
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Profile updated.
    *   `400 Bad Request`: Validation failure.

#### 2.2.3 Register FCM Token
*   **Method**: `POST`
*   **Route**: `/api/v1/users/me/fcm-token`
*   **Request Body**:
    ```json
    {
      "fcmToken": "fcm_token_string_from_android_sdk"
    }
    ```
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "message": "FCM Token registered successfully."
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Token mapped.
    *   `400 Bad Request`: Token missing from payload.

---

### 2.3 Devices Module

#### 2.3.1 List User Associated Devices
*   **Method**: `GET`
*   **Route**: `/api/v1/devices`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": [
        {
          "deviceId": "60d5ec49f1b29a1b18c5e002",
          "macAddress": "AA:BB:CC:DD:EE:FF",
          "serialNumber": "BMS-SN-998877",
          "connectionStatus": "ONLINE",
          "lastHeartbeat": "2026-07-03T13:14:00Z"
        }
      ]
    }
    ```
*   **Status Codes**: `200 OK`.

#### 2.3.2 Provision Device (Admin / Tech Only)
*   **Method**: `POST`
*   **Route**: `/api/v1/devices/provision`
*   **Request Body**:
    ```json
    {
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "serialNumber": "BMS-SN-998877"
    }
    ```
*   **Response Format** (`201 Created`):
    ```json
    {
      "success": true,
      "message": "Device hardware entry provisioned.",
      "data": {
        "deviceId": "60d5ec49f1b29a1b18c5e002",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "serialNumber": "BMS-SN-998877",
        "connectionStatus": "OFFLINE"
      }
    }
    ```
*   **Status Codes**:
    *   `201 Created`: Hardware record initialized.
    *   `403 Forbidden`: User lacks technician status.
    *   `409 Conflict`: MAC address or serial number already exists.

#### 2.3.3 Claim Device (Owner Claim)
*   **Method**: `POST`
*   **Route**: `/api/v1/devices/claim`
*   **Request Body**:
    ```json
    {
      "serialNumber": "BMS-SN-998877"
    }
    ```
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "message": "Device associated with account.",
      "data": {
        "deviceId": "60d5ec49f1b29a1b18c5e002",
        "associatedPackId": "60d5ec49f1b29a1b18c5e003"
      }
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Associated successfully.
    *   `404 Not Found`: Serial number not registered/provisioned.
    *   `409 Conflict`: Device already claimed by another user.

---

### 2.4 Battery Packs Module

#### 2.4.1 List Battery Packs
*   **Method**: `GET`
*   **Route**: `/api/v1/packs`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": [
        {
          "packId": "60d5ec49f1b29a1b18c5e003",
          "serialNumber": "PACK-SN-554433",
          "modelNumber": "BMS-48V-100AH",
          "chemistry": "LFP",
          "nominalCapacityAh": 100
        }
      ]
    }
    ```
*   **Status Codes**: `200 OK`.

#### 2.4.2 Get Battery Pack Details (with embedded structures)
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "packId": "60d5ec49f1b29a1b18c5e003",
        "serialNumber": "PACK-SN-554433",
        "modelNumber": "BMS-48V-100AH",
        "chemistry": "LFP",
        "nominalCapacityAh": 100,
        "nominalVoltage": 51.2,
        "firmwareVersion": "v1.2.4",
        "cells": [
          { "cellIndex": 0, "manufacturer": "CATL", "internalResistanceMohm": 0.8 },
          { "cellIndex": 1, "manufacturer": "CATL", "internalResistanceMohm": 0.82 }
        ],
        "settings": {
          "cellOverVoltageLimit": 3.65,
          "cellUnderVoltageLimit": 2.5,
          "maxChargeCurrentLimit": 50,
          "maxDischargeCurrentLimit": 100
        }
      }
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Metadata returned.
    *   `404 Not Found`: Battery pack ID invalid.

---

### 2.5 Battery Cells Module (Nested Resources)

#### 2.5.1 List Cell Layout
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/cells`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": [
        { "cellIndex": 0, "serialNumber": "C001", "manufacturer": "CATL", "internalResistanceMohm": 0.8 },
        { "cellIndex": 1, "serialNumber": "C002", "manufacturer": "CATL", "internalResistanceMohm": 0.82 }
      ]
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

#### 2.5.2 Update Cell Metadata (Technician Only)
*   **Method**: `PUT`
*   **Route**: `/api/v1/packs/:packId/cells/:cellIndex`
*   **Request Body**:
    ```json
    {
      "serialNumber": "C001-NEW",
      "internalResistanceMohm": 0.78
    }
    ```
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "message": "Cell metadata updated."
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Subdocument modified.
    *   `400 Bad Request`: Invalid parameters.
    *   `403 Forbidden`: Admin/Tech role required.

---

### 2.6 Real-Time Telemetry Module

#### 2.6.1 Get Latest Telemetry Snapshot
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/telemetry/latest`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "timestamp": "2026-07-03T13:14:59Z",
        "soc": 88,
        "soh": 99,
        "packVoltage": 52.8,
        "packCurrent": 12.5,
        "powerW": 660,
        "cellVoltages": [3.3, 3.31, 3.29, 3.3],
        "temperatures": [28.5, 29.1],
        "balancingStates": [false, true, false, false]
      }
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

#### 2.6.2 Query Historical Telemetry (Time-Series Query)
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/telemetry`
*   **Query Parameters**:
    *   `start`: ISO Date String (e.g. `2026-07-03T00:00:00Z`)
    *   `end`: ISO Date String (e.g. `2026-07-03T23:59:59Z`)
    *   `resolution`: String (e.g. `1m`, `5m`, `1h` - triggers DB downsampling)
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "meta": { "packId": "60d5ec49f1b29a1b18c5e003", "count": 288 },
      "data": [
        { "t": "2026-07-03T13:00:00Z", "v": 52.8, "i": 12.5, "soc": 88 },
        { "t": "2026-07-03T13:05:00Z", "v": 52.9, "i": 12.4, "soc": 89 }
      ]
    }
    ```
*   **Status Codes**:
    *   `200 OK`: Time-series array returned.
    *   `400 Bad Request`: Missing start/end range, range exceeds maximum size.

---

### 2.7 Charging Control Module

#### 2.7.1 Toggle Charge Protection Switch
*   **Method**: `POST`
*   **Route**: `/api/v1/packs/:packId/control/charge`
*   **Request Body**:
    ```json
    {
      "enable": false
    }
    ```
*   **Response Format** (`202 Accepted`):
    ```json
    {
      "success": true,
      "message": "MOSFET Charge switch override command sent to queue."
    }
    ```
*   **Status Codes**:
    *   `202 Accepted`: Accepted and command sent to device via MQTT.
    *   `400 Bad Request`: Missing enable boolean.
    *   `503 Service Unavailable`: Physical gateway is currently offline.

#### 2.7.2 Toggle Discharge Protection Switch
*   **Method**: `POST`
*   **Route**: `/api/v1/packs/:packId/control/discharge`
*   **Request Body**:
    ```json
    {
      "enable": true
    }
    ```
*   **Response Format** (`202 Accepted`):
    ```json
    {
      "success": true,
      "message": "MOSFET Discharge switch command sent to queue."
    }
    ```
*   **Status Codes**: `202 Accepted`, `503 Service Unavailable`.

---

### 2.8 Firmware & OTA Updates Module

#### 2.8.1 Upload Firmware Binary (Admin Only)
*   **Method**: `POST`
*   **Route**: `/api/v1/firmware`
*   **Request Body**:
    ```json
    {
      "version": "v1.2.5",
      "compatibleHardwareVersions": ["BMS-REV-A"],
      "binaryUrl": "https://storage.googleapis.com/bms-ota/v1.2.5.bin",
      "checksum": "8f438a2e...",
      "releaseNotes": "Thermal safety fixes.",
      "isCritical": true
    }
    ```
*   **Response Format** (`210 Created`):
    ```json
    {
      "success": true,
      "data": {
        "firmwareId": "60d5ec49f1b29a1b18c5e005",
        "version": "v1.2.5"
      }
    }
    ```
*   **Status Codes**: `201 Created`, `403 Forbidden`, `409 Conflict`.

#### 2.8.2 Check Version Compatibility
*   **Method**: `GET`
*   **Route**: `/api/v1/firmware/check`
*   **Query Parameters**:
    *   `hardwareVersion`: e.g. `"BMS-REV-A"`
    *   `currentVersion`: e.g. `"v1.2.4"`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "updateAvailable": true,
        "isCritical": true,
        "latestVersion": "v1.2.5",
        "downloadUrl": "https://storage.googleapis.com/bms-ota/v1.2.5.bin",
        "checksum": "8f438a2e..."
      }
    }
    ```
*   **Status Codes**: `200 OK`.

#### 2.8.3 Trigger Remote OTA Execution (Admin/Tech Only)
*   **Method**: `POST`
*   **Route**: `/api/v1/firmware/updates/initiate`
*   **Request Body**:
    ```json
    {
      "deviceId": "60d5ec49f1b29a1b18c5e002",
      "firmwareId": "60d5ec49f1b29a1b18c5e005"
    }
    ```
*   **Response Format** (`202 Accepted`):
    ```json
    {
      "success": true,
      "data": {
        "updateId": "60d5ec49f1b29a1b18c5e006",
        "status": "PENDING"
      }
    }
    ```
*   **Status Codes**: `202 Accepted`, `404 Not Found`, `503 Service Unavailable`.

#### 2.8.4 Fetch Update Installation Progress
*   **Method**: `GET`
*   **Route**: `/api/v1/firmware/updates/:updateId`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "updateId": "60d5ec49f1b29a1b18c5e006",
        "status": "FLASHING",
        "progressPercentage": 64,
        "errorLog": null
      }
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

---

### 2.9 Notifications Module

#### 2.9.1 List User Notifications
*   **Method**: `GET`
*   **Route**: `/api/v1/notifications`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": [
        {
          "notificationId": "60d5ec49f1b29a1b18c5e007",
          "title": "Low Temperature Warning",
          "body": "Battery temperature is 1°C. Charging limit reduced.",
          "sentAt": "2026-07-03T13:10:00Z"
        }
      ]
    }
    ```
*   **Status Codes**: `200 OK`.

#### 2.9.2 Mark Notification as Read
*   **Method**: `PUT`
*   **Route**: `/api/v1/notifications/:notificationId/read`
*   **Request Body**: None
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "message": "Notification marked as read."
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

---

### 2.10 Fault & Alert Logs Module

#### 2.10.1 List Battery Pack Fault Logs
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/faults`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": [
        {
          "faultId": "60d5ec49f1b29a1b18c5e008",
          "timestamp": "2026-07-03T12:00:00Z",
          "faultCode": "COV",
          "description": "Cell Over Voltage",
          "triggeredValue": 3.71,
          "severity": "CRITICAL"
        }
      ]
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

#### 2.10.2 Get Active Dashboard Alerts
*   **Method**: `GET`
*   **Route**: `/api/v1/alerts/active`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": [
        {
          "alertId": "60d5ec49f1b29a1b18c5e009",
          "packId": "60d5ec49f1b29a1b18c5e003",
          "severity": "CRITICAL",
          "type": "THERMAL_OVERLIMIT",
          "message": "Active thermal alert: Pack temp exceeds 65°C."
        }
      ]
    }
    ```
*   **Status Codes**: `200 OK`.

#### 2.10.3 Resolve Alert (Technician Only)
*   **Method**: `PUT`
*   **Route**: `/api/v1/alerts/:alertId/resolve`
*   **Request Body**: None
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "message": "Alert marked as resolved."
    }
    ```
*   **Status Codes**: `200 OK`, `403 Forbidden`, `404 Not Found`.

---

### 2.11 Charging History Module

#### 2.11.1 List Charging Sessions
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/charging-sessions`
*   **Query Parameters**:
    *   `page`: Number (Default: 1)
    *   `limit`: Number (Default: 10)
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "pagination": { "page": 1, "limit": 10, "total": 45 },
      "data": [
        {
          "sessionId": "60d5ec49f1b29a1b18c5e010",
          "startTime": "2026-07-02T22:00:00Z",
          "endTime": "2026-07-03T04:30:00Z",
          "startSoc": 15,
          "endSoc": 100,
          "energyAddedWh": 4350,
          "sessionStatus": "COMPLETED"
        }
      ]
    }
    ```
*   **Status Codes**: `200 OK`.

#### 2.11.2 Get Session Details
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/charging-sessions/:sessionId`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "sessionId": "60d5ec49f1b29a1b18c5e010",
        "startTime": "2026-07-02T22:00:00Z",
        "endTime": "2026-07-03T04:30:00Z",
        "startSoc": 15,
        "endSoc": 100,
        "energyAddedWh": 4350,
        "peakCurrent": 45.2,
        "peakTemperature": 38.5,
        "sessionStatus": "COMPLETED"
      }
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

---

### 2.12 Device Configuration & Settings Module

#### 2.12.1 Get Current Settings
*   **Method**: `GET`
*   **Route**: `/api/v1/packs/:packId/settings`
*   **Response Format** (`200 OK`):
    ```json
    {
      "success": true,
      "data": {
        "cellOverVoltageLimit": 3.65,
        "cellUnderVoltageLimit": 2.50,
        "maxChargeCurrentLimit": 50.0,
        "maxDischargeCurrentLimit": 100.0,
        "balancingStartVoltage": 3.40,
        "temperatureHighLimit": 60.0
      }
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found`.

#### 2.12.2 Update Threshold Settings (Technician Only)
*   **Method**: `PUT`
*   **Route**: `/api/v1/packs/:packId/settings`
*   **Request Body**:
    ```json
    {
      "cellOverVoltageLimit": 3.60,
      "cellUnderVoltageLimit": 2.60,
      "maxChargeCurrentLimit": 45.0,
      "maxDischargeCurrentLimit": 90.0,
      "balancingStartVoltage": 3.35,
      "temperatureHighLimit": 55.0
    }
    ```
*   **Response Format** (`202 Accepted`):
    ```json
    {
      "success": true,
      "message": "Settings update request received. Flashing update command queued to device."
    }
    ```
*   **Status Codes**:
    *   `202 Accepted`: Command queued (will be pushed to device over MQTT).
    *   `400 Bad Request`: Validation failure.
    *   `403 Forbidden`: Technician credentials required.
    *   `503 Service Unavailable`: Target device offline.
