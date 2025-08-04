# node-red-contrib-netpie

A Node-RED node collection for connecting to NETPIE/NEXPIE IoT Platform. This package provides comprehensive IoT device simulation, data management, and cloud communication capabilities.

## Installation

```bash
npm install node-red-contrib-netpie
```

Or install via the Node-RED Palette Manager.

## Features

- **Device Simulation**: Complete IoT device simulation with bidirectional communication
- **Real-time Messaging**: Subscribe to and publish messages using MQTT topics
- **Shadow Management**: Monitor and update device shadow data  
- **Historical Data**: Retrieve time-series feed data with flexible time ranges
- **Device Status**: Monitor device connectivity and operational status
- **Push Notifications**: Send notifications to mobile applications
- **Command Operations**: Execute various device operations and commands

## Nodes

### Device Node
Simulates a real IoT device with full bidirectional communication capabilities.
- Publishes and subscribes to MQTT topics
- Handles shadow data updates
- Supports private messaging
- Configurable output formats (String, Buffer, JSON)

### Command Node  
Executes various operations on NETPIE devices:
- **Publish Message**: Send data to device topics
- **Write Shadow**: Update device shadow data
- **Get Shadow**: Retrieve current shadow data
- **Get Device Status**: Check device connectivity
- **Push Notification**: Send mobile notifications

### Shadow Node
Monitors device shadow data change and may alter if needed.
- Real-time shadow update notifications
- Configurable output modes (updated fields or entire shadow)
- Manual data refresh capability

### Feed Node
Retrieves both realtime and historical time-series data from devices.
- Flexible time range queries (absolute or relative)
- Data sampling and aggregation
- Real-time feed monitoring
- Multiple time format support

### Message Node
Lightweight message subscription for specific topics.
- Subscribe to @msg topics only
- Configurable output formats
- Topic pattern matching with wildcards
- Dynamic topic management

### Status Node
Monitors device connectivity and operational status.
- Real-time status updates
- Device information (ID, group, project)
- Status change notifications

## Configuration

### Device Configuration
Before using any nodes, configure your NETPIE device credentials:

1. Add a **Device Config** node
2. Enter your Device ID and Token from NETPIE Portal
3. Configure the connection endpoint (NETPIE/NEXPIE)
4. Set up channel configuration if needed

### Real-time Features
Some nodes support real-time features that require channel connections:
- **Enabled**: Automatic notifications when data changes
- **Disabled**: Manual data retrieval only (still functional)

## Usage Examples

### Basic Device Simulation
```javascript
// Device node configuration
{
  "name": "Temperature Sensor",
  "topics": "@msg/temperature\n@msg/humidity",
  "outputType": "JSON",
  "subshadow": true
}
```

### Shadow Data Management
```javascript
// Command node - Write Shadow
{
  "commandtype": "writeshadow",
  "inputformat": "json",
  "shadowproperty": "{\"temp\": 25.5, \"status\": \"online\"}"
}
```

### Historical Data Query
```javascript
// Feed node - Last 24 hours
{
  "beginrelativevalue": 24,
  "beginrelativeunit": "hours", 
  "endrelativevalue": 0,
  "samplingvalue": 1,
  "samplingunit": "hours"
}
```

## Topic Conventions

NETPIE uses specific topic prefixes:
- `@msg/topic` - Public message topics
- `@private/topic` - Private message topics  
- `#` - Wildcard for all topics
- `+` - Single level wildcard

## Data Formats

### Shadow Data Structure
```json
{
  "data": {
    "temperature": 25.5,
    "humidity": 60.2,
    "status": "online"
  }
}
```

### Device Status Structure
```json
{
  "deviceid": "17a30f78-27da-9173-92b2-652ca0b20cf8",
  "groupid": "G713335850114", 
  "projectid": "P060627955206",
  "status": 1,
  "enabled": true
}
```

## Requirements

- Node-RED version 1.0.0+
- NETPIE/NEXPIE account and registered devices
- Valid Device ID and Token from NETPIE Portal

## Dependencies

- `mqtt`: MQTT client for device communication
- `axios`: HTTP client for API requests
- `deepmerge`: Object merging utilities
- `jsonic`: JSON parsing
- `object-path`: Object property access

## Support

- [NETPIE Documentation](https://docs.netpie.io/)
- [NEXPIE Platform](https://nexpie.io/)
- [GitHub Issues](https://github.com/chavee/node-red-contrib-netpie/issues)

## License

ISC License

## Author

chavee@nexpie.com

---

For detailed node documentation, see the help panels in Node-RED editor or visit the [NETPIE documentation](https://docs.netpie.io/).