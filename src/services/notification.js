const admin = require('firebase-admin');
const User = require('../models/User');

let isInitialized = false;

// Attempt to initialize Firebase Admin SDK with graceful mock fallback
try {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      // Try parsing as raw JSON string
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
      console.log('Firebase Admin SDK initialized using environment JSON string');
    } catch (e) {
      // Try loading as local file path
      credential = admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('Firebase Admin SDK initialized using environment file path');
    }
  } else {
    // Try loading local service account key file
    try {
      const serviceAccount = require('../../config/firebase-service-account.json');
      credential = admin.credential.cert(serviceAccount);
      console.log('Firebase Admin SDK initialized using local configuration file');
    } catch (err) {
      // No credentials found. Continue in mock fallback mode
    }
  }

  if (credential) {
    admin.initializeApp({ credential });
    isInitialized = true;
  } else {
    console.warn('⚠️ Firebase Admin credentials not found. Push Notification service running in fallback MOCK mode.');
  }
} catch (error) {
  console.error('⚠️ Failed to initialize Firebase Admin SDK. Push Notification running in fallback MOCK mode. Error:', error.message);
}

/**
 * Send push notification to a user's registered FCM token
 * @param {string} userId - Mongoose User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {object} data - Optional dictionary of key-value metadata
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[Push Notification Alert] User with ID ${userId} not found.`);
      return;
    }

    if (!user.fcmToken) {
      console.log(`[Push Notification Alert] User ${user.email} has no registered FCM token. Skipping notification.`);
      return;
    }

    // Convert data values to strings as required by Firebase
    const stringifiedData = {};
    for (const [key, value] of Object.entries(data)) {
      stringifiedData[key] = String(value);
    }

    if (isInitialized) {
      const message = {
        notification: { title, body },
        data: stringifiedData,
        token: user.fcmToken
      };

      try {
        const response = await admin.messaging().send(message);
        console.log(`✅ Push notification sent successfully to User ${user.email}. Message ID: ${response}`);
      } catch (err) {
        console.error(`💥 Failed to send push notification to User ${user.email}:`, err.message);
        
        // Clean up expired or unregistered tokens automatically
        if (
          err.code === 'messaging/invalid-argument' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          user.fcmToken = null;
          await user.save();
          console.log(`🧼 Invalid token swept from database for User ${user.email}.`);
        }
      }
    } else {
      // Fallback Mock console trace
      console.log('---------------- 🔔 MOCK PUSH NOTIFICATION TRIGGERED ----------------');
      console.log(`Target User ID: ${userId} (${user.email})`);
      console.log(`Target FCM Token: ${user.fcmToken}`);
      console.log(`Title: ${title}`);
      console.log(`Body: ${body}`);
      console.log(`Data Payload:`, JSON.stringify(stringifiedData, null, 2));
      console.log('---------------------------------------------------------------------');
    }
  } catch (error) {
    console.error(`💥 Push notification error: ${error.message}`);
  }
};

module.exports = {
  sendPushNotification
};
