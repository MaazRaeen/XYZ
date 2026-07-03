# Database Schema Design Specification (MongoDB & Mongoose)
## Project: Battery Management System (BMS) Backend

---

## 1. Schema Strategy: Embedding vs. Referencing

To ensure high performance, scalability, and clean data integrity, the system applies strict rules to decide when to embed documents (sub-documents) vs. when to reference them (via `ObjectId` references):

```
                       ┌─────────────────────────┐
                       │   Relationship Type     │
                       └────────────┬────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [ One-to-Few / Static ]             [ One-to-Many / Dynamic ]
        - Low data volume                   - Infinite growth potential
        - Read-together usage               - Queries needed independently
        - Infrequent updates                - Reusable across collections
                  │                                   │
                  ▼                                   ▼
          ┌───────────────┐                   ┌───────────────┐
          │    EMBED      │                   │   REFERENCE   │
          └───────────────┘                   └───────────────┘
```

### 1.1 When to Embed (Sub-documents)
We embed data when the child dataset is:
*   **Bounded / Small**: The number of children is fixed or has a strict low limit (e.g., cell configuration in a pack, local settings block).
*   **Read-Dependent**: The parent document is almost never queried without needing this child data.
*   **Statically Linked**: The child data does not have an independent lifecycle outside the parent (e.g., a cell inside a specific pack doesn't exist on its own).
*   *Collections Embedded*: `batteryCells` (within `batteryPacks`), `deviceSettings` (within `batteryPacks` or as sub-documents).

### 1.2 When to Reference (`ObjectId` Refs)
We use references when the child dataset:
*   **Grows Unboundedly**: The relationship is one-to-many and can scale to thousands or millions of documents (e.g., telemetry logs, alerts, charging sessions). Embedding this would exceed the 16MB document size limit in MongoDB.
*   **Requires Independent Queries**: The collection needs to be aggregated, searched, or processed on its own (e.g., searching all critical alerts across all packs).
*   **Shared Lifecycles**: Documents are linked to multiple entities (e.g., a `User` linked to a `device`, or a `firmware` linked to many `firmwareUpdates`).
*   *Collections Referenced*: `users`, `devices`, `batteryPacks`, `chargingSessions`, `telemetryLogs`, `faultLogs`, `alerts`, `notifications`, `firmware`, `firmwareUpdates`, `maintenanceHistory`, `chargingSchedules`.

---

## 2. High-Frequency Telemetry Logs Optimization

For a BMS, battery packs can upload telemetry at high frequencies (1Hz to 5Hz over local BLE, and 0.1Hz to 0.5Hz over remote MQTT). This leads to millions of writes per day per device. 

### 2.1 The Solution: MongoDB Time-Series Collections
Introduced in MongoDB 5.0, **Time-Series Collections** are natively optimized to store sequential physical measurements. They offer superior query performance, automatic columnar compression, and reduced disk footprints compared to standard collections or custom bucketing patterns.

```
                  Raw Telemetry Stream (1Hz - 5Hz)
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ MongoDB Query Engine  │
                     └───────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │ Columnar Bucketing    │ (Internal Optimization)
                     └───────────┬───────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
     [ Meta Bucket ]     [ Time Bucket ]     [ Data Bucket ]
       - packId            - Start/End         - Voltages
       - serialNumber      - Timestamps        - Currents
```

#### Time-Series Parameters:
*   **timeField**: `"timestamp"` (Must be a BSON Date).
*   **metaField**: `"packId"` (Used to group documents by device; indexed automatically).
*   **granularity**: `"seconds"` (Perfect for high-frequency measurements).
*   **expireAfterSeconds**: `7776000` (90 days TTL auto-eviction policy to manage database growth).

#### How it works:
MongoDB automatically buckets telemetry internally. Instead of creating a new physical BSON document on disk for every single write, it batches writes for the same `packId` over a time span (e.g., 1 minute) into a single optimized block containing compressed arrays of values. This reduces indexes overhead and maximizes write throughput.

---

## 3. Detailed Collection Specs & Relationships

### 3.1 `users`
*   **Description**: Stores credential hashes and profile data for owners and technicians.
*   **Fields**:
    *   `_id`: ObjectId
    *   `email`: String (Unique, Indexed, Lowercase validation)
    *   `passwordHash`: String (Bcrypt encrypted)
    *   `role`: String (Enum: `['user', 'tech', 'admin']`)
    *   `firstName`: String
    *   `lastName`: String
    *   `fcmTokens`: Array[String] (For pushing notifications to matched devices)
*   **Relationships**: Referenced by `batteryPacks` and `notifications`.
*   **Indexes**: `{ email: 1 }` (Unique).

### 3.2 `devices`
*   **Description**: Represents physical hardware IoT communication modules (the BLE/Wi-Fi telemetry box).
*   **Fields**:
    *   `_id`: ObjectId
    *   `macAddress`: String (Unique, Indexed, hardware ID)
    *   `serialNumber`: String (Unique)
    *   `connectionStatus`: String (Enum: `['ONLINE', 'OFFLINE', 'MAINTENANCE']`)
    *   `lastHeartbeat`: Date
    *   `associatedPackId`: ObjectId (Ref to `batteryPacks`, Nullable)
*   **Relationships**: References `batteryPacks`.
*   **Indexes**: `{ macAddress: 1 }` (Unique), `{ associatedPackId: 1 }`.

### 3.3 `batteryPacks`
*   **Description**: Represents the battery pack enclosure, nominal capacity, and physical properties.
*   **Fields**:
    *   `_id`: ObjectId
    *   `serialNumber`: String (Unique, Indexed)
    *   `modelNumber`: String
    *   `chemistry`: String (Enum: `['LFP', 'NMC', 'LTO']`)
    *   `nominalCapacityAh`: Number
    *   `nominalVoltage`: Number
    *   `ownerId`: ObjectId (Ref to `users`, Nullable)
    *   `deviceId`: ObjectId (Ref to `devices`, Nullable)
    *   `firmwareVersion`: String
    *   `cells`: Array[Embedded `batteryCells` Schema] (Embedded because cells are static structural sub-components of a physical pack)
    *   `settings`: Embedded `deviceSettings` Schema (Embedded for atomic reads when accessing battery data)
*   **Relationships**: References `users` and `devices`. Embeds `batteryCells` and `deviceSettings`.
*   **Indexes**: `{ serialNumber: 1 }` (Unique), `{ ownerId: 1 }`, `{ deviceId: 1 }`.

### 3.4 `batteryCells` (Embedded Sub-document)
*   **Description**: Embedded array inside `batteryPacks`. Captures metadata of individual physical cells inside the pack.
*   **Fields**:
    *   `cellIndex`: Number (e.g., 0 to 15 for 16S packs)
    *   `serialNumber`: String (Unique if laser-etched on hardware cell, Nullable)
    *   `manufacturer`: String
    *   `internalResistanceMohm`: Number (Initial resistance value)
    *   `capacityAh`: Number

### 3.5 `deviceSettings` (Embedded Sub-document)
*   **Description**: The operating configuration parameters loaded into the BMS.
*   **Fields**:
    *   `cellOverVoltageLimit`: Number (Volts)
    *   `cellUnderVoltageLimit`: Number (Volts)
    *   `maxChargeCurrentLimit`: Number (Amperes)
    *   `maxDischargeCurrentLimit`: Number (Amperes)
    *   `balancingStartVoltage`: Number (Volts)
    *   `temperatureHighLimit`: Number (°C)
    *   `lastSyncTimestamp`: Date (When these settings were successfully flashed onto the physical device)

### 3.6 `chargingSessions`
*   **Description**: Compiled history summaries of distinct charging cycles.
*   **Fields**:
    *   `_id`: ObjectId
    *   `packId`: ObjectId (Ref to `batteryPacks`, Indexed)
    *   `startTime`: Date (Indexed)
    *   `endTime`: Date
    *   `startSoc`: Number
    *   `endSoc`: Number
    *   `energyAddedWh`: Number
    *   `peakCurrent`: Number
    *   `peakTemperature`: Number
    *   `sessionStatus`: String (Enum: `['COMPLETED', 'INTERRUPTED', 'FAULT_TRIPPED']`)
*   **Relationships**: References `batteryPacks`.
*   **Indexes**: `{ packId: 1, startTime: -1 }` (Composite index for listing historical sessions newest first).

### 3.7 `telemetryLogs` (Time-Series Collection)
*   **Description**: High-frequency streaming logs of system metrics.
*   **Fields**:
    *   `timestamp`: Date (Time-series timeField, Indexed)
    *   `packId`: ObjectId (Ref to `batteryPacks`, Time-series metaField, Indexed)
    *   `packVoltage`: Number (Volts)
    *   `packCurrent`: Number (Amperes)
    *   `soc`: Number (0-100)
    *   `soh`: Number (0-100)
    *   `powerW`: Number (Calculated PackVoltage * PackCurrent)
    *   `cellVoltages`: Array[Number] (Voltages of each cell in order of index)
    *   `temperatures`: Array[Number] (Readings from multiple sensor probes)
    *   `balancingStates`: Array[Boolean] (True if cell index is actively balancing)
*   **Relationships**: References `batteryPacks` via `metaField`.
*   **Indexes**: MongoDB automatically creates index `{ packId: 1, timestamp: -1 }` on time-series collections.

### 3.8 `faultLogs`
*   **Description**: Historical log of safety protection shutdowns and alarm events.
*   **Fields**:
    *   `_id`: ObjectId
    *   `packId`: ObjectId (Ref to `batteryPacks`, Indexed)
    *   `timestamp`: Date (Indexed)
    *   `faultCode`: String (Enum: `['COV', 'CUV', 'OCC', 'OCD', 'OTP', 'UTP', 'SCP']`)
    *   `description`: String
    *   `triggeredValue`: Number (The sensor reading that caused the fault, e.g., "4.25V")
    *   `cellVoltagesAtTrigger`: Array[Number]
    *   `severity`: String (Enum: `['WARNING', 'CRITICAL']`)
*   **Relationships**: References `batteryPacks`.
*   **Indexes**: `{ packId: 1, timestamp: -1 }`.

### 3.9 `alerts`
*   **Description**: Actionable, temporary alerts that need user resolution (e.g., shown on dashboard notifications badge).
*   **Fields**:
    *   `_id`: ObjectId
    *   `packId`: ObjectId (Ref to `batteryPacks`, Indexed)
    *   `userId`: ObjectId (Ref to `users`, Indexed)
    *   `severity`: String (Enum: `['INFO', 'WARNING', 'CRITICAL']`)
    *   `type`: String (e.g., `'LOW_BATTERY'`, `'CHARGING_COMPLETE'`)
    *   `message`: String
    *   `isRead`: Boolean (Default: `false`)
    *   `createdAt`: Date (Default: `Date.now`)
*   **Relationships**: References `batteryPacks` and `users`.
*   **Indexes**: `{ userId: 1, isRead: 1 }` (Optimizes fetching unread notifications for a user dashboard).

### 3.10 `notifications`
*   **Description**: Push notification archive representing items pushed out through Firebase Cloud Messaging (FCM).
*   **Fields**:
    *   `_id`: ObjectId
    *   `userId`: ObjectId (Ref to `users`, Indexed)
    *   `deviceId`: ObjectId (Ref to `devices`, Nullable)
    *   `title`: String
    *   `body`: String
    *   `sentStatus`: String (Enum: `['SENT', 'FAILED']`)
    *   `fcmMessageId`: String
    *   `sentAt`: Date
*   **Relationships**: References `users` and `devices`.
*   **Indexes**: `{ userId: 1, sentAt: -1 }`.

### 3.11 `firmware`
*   **Description**: Repository of compiled bin files and compatibility indexes.
*   **Fields**:
    *   `_id`: ObjectId
    *   `version`: String (Unique version code, e.g., `"v1.2.4"`)
    *   `hardwareRevisionCompatibility`: Array[String] (e.g., `["HW_REV_A", "HW_REV_B"]`)
    *   `binaryUrl`: String (Cloud bucket URL for firmware binary)
    *   `checksum`: String (SHA-256 validation code)
    *   `releaseNotes`: String
    *   `isCritical`: Boolean
    *   `createdAt`: Date
*   **Indexes**: `{ version: 1 }` (Unique).

### 3.12 `firmwareUpdates`
*   **Description**: Tracks the installation process and logs failures during firmware flashing.
*   **Fields**:
    *   `_id`: ObjectId
    *   `deviceId`: ObjectId (Ref to `devices`, Indexed)
    *   `firmwareId`: ObjectId (Ref to `firmware`, Indexed)
    *   `status`: String (Enum: `['PENDING', 'DOWNLOADING', 'VERIFYING', 'FLASHING', 'SUCCESS', 'FAILED']`)
    *   `progressPercentage`: Number (0-100)
    *   `errorLog`: String (Details if status is `FAILED`)
    *   `startedAt`: Date
    *   `completedAt`: Date
*   **Relationships**: References `devices` and `firmware`.
*   **Indexes**: `{ deviceId: 1, status: 1 }`.

### 3.13 `maintenanceHistory`
*   **Description**: Tracks physical services, repairs, capacity calibration, or battery rebuild operations.
*   **Fields**:
    *   `_id`: ObjectId
    *   `packId`: ObjectId (Ref to `batteryPacks`, Indexed)
    *   `technicianId`: ObjectId (Ref to `users`, Indexed)
    *   `actionPerformed`: String (e.g., `'CELL_SWAP'`, `'CALIBRATION'`, `'CONNECTOR_REPLACEMENT'`)
    *   `notes`: String
    *   `replacedCellIndices`: Array[Number] (e.g. `[4]` if cell 4 was replaced)
    *   `executionDate`: Date
*   **Relationships**: References `batteryPacks` and `users`.
*   **Indexes**: `{ packId: 1, executionDate: -1 }`.

### 3.14 `chargingSchedules`
*   **Description**: Defines configurations for automated grid integration (e.g., charge only during low-tariff off-peak times).
*   **Fields**:
    *   `_id`: ObjectId
    *   `packId`: ObjectId (Ref to `batteryPacks`, Indexed)
    *   `startTime`: String (e.g., `"22:00"` 24h format)
    *   `endTime`: String (e.g., `"06:00"`)
    *   `repeatDays`: Array[Number] (Enum values `[0..6]`, 0 = Sunday)
    *   `maxChargeCurrent`: Number (Amperes limit during this schedule window)
    *   `isEnabled`: Boolean (Default: `true`)
*   **Relationships**: References `batteryPacks`.
*   **Indexes**: `{ packId: 1 }`.
