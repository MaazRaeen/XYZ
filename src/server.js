const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const globalErrorHandler = require('./middleware/error.middleware');
const AppError = require('./utils/appError');

// Initialize Express Application
const app = express();

// Connect to database
connectDB();

// Register Security and Parser Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Register Request Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Mount versioned routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);

// Capture unhandled routes (404s)
app.all('*', (req, res, next) => {
  next(new AppError(`Requested resource ${req.originalUrl} not found on this server`, 404));
});

// Centralized error handling middleware
app.use(globalErrorHandler);

// Start listening for connections
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`BMS backend server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle system unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Initiating graceful shutdown...');
  console.error(err.name, err.message, err.stack);
  server.close(() => {
    process.exit(1);
  });
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM Signal received. Shutting down server gracefully...');
  server.close(() => {
    console.log('Process gracefully terminated.');
  });
});
