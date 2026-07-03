const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');

/**
 * Generate Access Token signed with access secret
 */
const signAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN
  });
};

/**
 * Generate Refresh Token signed with refresh secret
 */
const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN
  });
};

/**
 * Utility helper to sign and deliver tokens via body + secure cookies
 */
const sendTokens = (user, statusCode, res) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Configure cookie options (7 days cookie life)
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  // Sanitize sensitive user output
  user.password = undefined;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  res.status(statusCode).json({
    success: true,
    data: {
      accessToken,
      user
    }
  });
};

/**
 * Register User
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email address is already in use.', 409));
    }

    // Create User record (Pre-save hook will hash password)
    const newUser = await User.create({
      name,
      email,
      password,
      role
    });

    sendTokens(newUser, 201, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Login User
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Retrieve user including password hash
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return next(new AppError('Incorrect email or password.', 401));
    }

    sendTokens(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh Access Token
 */
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return next(new AppError('Refresh token is missing from cookie payload.', 401));
    }

    // Verify token signature
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return next(new AppError('Invalid or expired refresh token. Please login again.', 401));
    }

    // Confirm token owner still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User belonging to refresh token no longer exists.', 401));
    }

    // Generate new Access Token
    const accessToken = signAccessToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout User
 */
const logout = async (req, res, next) => {
  try {
    // Overwrite the cookie with blank value and instant expiration
    res.cookie('refreshToken', 'loggedout', {
      expires: new Date(Date.now() + 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({
      success: true,
      message: 'Tokens cleared. Logged out successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request Password Reset (ForgotPassword)
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError('No account found matching this email address.', 404));
    }

    // Generate dynamic unhashed reset hex token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token to save safely in the database
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Expiration limit set to 10 minutes
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Mock Email Output - printed to dev environment stdout
    console.log('---------------- PASSWORD RESET PROCESS TRIGGERED ----------------');
    console.log(`Target Email: ${email}`);
    console.log(`Action Link Token: ${resetToken}`);
    console.log(`API URL Endpoint: POST /api/v1/auth/reset-password/${resetToken}`);
    console.log('------------------------------------------------------------------');

    res.status(200).json({
      success: true,
      message: 'Reset token successfully generated (logged to server console in dev environment).'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ingest Token and Reset Password (ResetPassword)
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash incoming parameter token to compare against database values
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Match active unexpired token values
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Reset token is invalid or has expired.', 400));
    }

    // Save new password (pre-save hook will hash it)
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. You can now login.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword
};
