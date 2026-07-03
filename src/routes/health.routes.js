const express = require('express');
const { getHealthStatus } = require('../controllers/health.controller');

const router = express.Router();

// Health check endpoint
router.get('/health', getHealthStatus);

module.exports = router;
