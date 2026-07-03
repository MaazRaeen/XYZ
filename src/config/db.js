const mongoose = require('mongoose');

/**
 * Establish connection to MongoDB database
 */
const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!connUri) {
      throw new Error('MONGODB_URI / MONGO_URI is not defined in environment variables');
    }

    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(connUri);

    console.log(`MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failure: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
