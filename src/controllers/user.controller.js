const User = require('../models/User');
const AppError = require('../utils/appError');

/**
 * Register or update the authenticated user's FCM device token
 * POST /api/users/fcm-token
 */
const updateFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return next(new AppError('FCM registration token (fcmToken) is required', 400));
    }

    // Retrieve active authenticated user profile
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new AppError('User account not found', 404));
    }

    user.fcmToken = fcmToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'FCM device token registered successfully.',
      data: {
        userId: user._id,
        email: user.email,
        fcmToken: user.fcmToken
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateFcmToken
};
