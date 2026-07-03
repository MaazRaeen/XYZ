const express = require('express');
const { body, query } = require('express-validator');
const deviceController = require('../controllers/device.controller');
const { protect } = require('../middleware/auth.middleware');
const validateFields = require('../middleware/validation.middleware');

const router = express.Router();

// Apply auth protection to all routes in this file
router.use(protect);

// Input Validation Schemas
const registerDeviceValidation = [
  body('deviceId')
    .notEmpty()
    .withMessage('Device identifier is required')
    .trim(),
  body('name')
    .notEmpty()
    .withMessage('Device display name is required')
    .trim(),
  body('connectionType')
    .isIn(['BLE', 'WiFi'])
    .withMessage('Connection type must be BLE or WiFi')
];

const updateDeviceValidation = [
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Device name cannot be blank')
    .trim(),
  body('connectionType')
    .optional()
    .isIn(['BLE', 'WiFi'])
    .withMessage('Connection type must be BLE or WiFi'),
  body('status')
    .optional()
    .isIn(['online', 'offline'])
    .withMessage('Status must be online or offline')
];

const saveTelemetryValidation = [
  body('voltage')
    .isFloat({ min: 0 })
    .withMessage('Voltage must be a positive number'),
  body('current')
    .isFloat()
    .withMessage('Current must be a valid number'),
  body('temperature')
    .isFloat()
    .withMessage('Temperature must be a valid number'),
  body('stateOfCharge')
    .isFloat({ min: 0, max: 100 })
    .withMessage('State of Charge must be a number between 0 and 100'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO8601 date string')
];

const logFaultValidation = [
  body('faultType')
    .isIn(['COV', 'CUV', 'OCC', 'OCD', 'OTP', 'UTP', 'SCP'])
    .withMessage('Invalid fault type code specified'),
  body('severity')
    .isIn(['info', 'warning', 'critical'])
    .withMessage('Severity must be info, warning, or critical'),
  body('message')
    .notEmpty()
    .withMessage('Fault warning description is required')
    .trim(),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO8601 date string')
];

const getTelemetryValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO8601 date string'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 date string'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page number must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Page limit must be an integer between 1 and 500')
];

const getFaultsValidation = [
  query('resolved')
    .optional()
    .isBoolean()
    .withMessage('Resolved flag must be a valid boolean value'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page number must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page limit must be a positive integer')
];

// Map endpoints to controller functions
router.route('/')
  .post(registerDeviceValidation, validateFields, deviceController.registerDevice)
  .get(deviceController.getDevices);

router.route('/:id')
  .get(deviceController.getDevice)
  .put(updateDeviceValidation, validateFields, deviceController.updateDevice)
  .delete(deviceController.deleteDevice);

router.route('/:id/telemetry')
  .post(saveTelemetryValidation, validateFields, deviceController.saveTelemetry)
  .get(getTelemetryValidation, validateFields, deviceController.getTelemetryHistory);

router.get('/:id/cells', deviceController.getLatestCellData);

router.route('/:id/faults')
  .post(logFaultValidation, validateFields, deviceController.logFault)
  .get(getFaultsValidation, validateFields, deviceController.getFaults);

module.exports = router;
