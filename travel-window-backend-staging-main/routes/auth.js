const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

const logAndRespond500 = (res, req, route, error) => {
  console.error(JSON.stringify({
    level: 'error',
    route,
    requestId: req.id,
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack
  }));
  res.status(500).json({ message: 'Server error', requestId: req.id });
};

// Register (Admin only - will be handled separately)
// Verify reCAPTCHA token with Google (optional – only when RECAPTCHA_SECRET is set).
// Existing policy is fail-closed: any error (timeout, network failure, non-OK
// response, malformed body) rejects the captcha rather than letting the login
// through — preserved as-is here, just bounded so a hung/slow Google endpoint
// can't hang the login request indefinitely.
const RECAPTCHA_TIMEOUT_MS = 5000;

async function verifyRecaptcha(token, requestId) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return true;
  if (!token) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECAPTCHA_TIMEOUT_MS);
  try {
    const qs = new URLSearchParams({ secret, response: token });
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs.toString(),
      signal: controller.signal
    });

    if (!resp.ok) {
      console.error(JSON.stringify({ level: 'error', route: 'verifyRecaptcha', requestId, message: `Google returned HTTP ${resp.status}` }));
      return false;
    }

    let data;
    try {
      data = await resp.json();
    } catch (parseError) {
      console.error(JSON.stringify({ level: 'error', route: 'verifyRecaptcha', requestId, message: 'Non-JSON response from Google' }));
      return false;
    }

    return !!data?.success;
  } catch (e) {
    const reason = e.name === 'AbortError' ? 'timeout' : e.message;
    console.error(JSON.stringify({ level: 'error', route: 'verifyRecaptcha', requestId, errorName: e.name, errorMessage: reason }));
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    const recaptchaOk = await verifyRecaptcha(recaptchaToken, req.id);
    if (!recaptchaOk) {
      return res.status(400).json({ message: 'Captcha verification failed. Please try again.' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        photo: user.photo || ''
      }
    });
  } catch (error) {
    logAndRespond500(res, req, 'POST /api/auth/login', error);
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        photo: user.photo || ''
      }
    });
  } catch (error) {
    logAndRespond500(res, req, 'GET /api/auth/me', error);
  }
});

// Update profile (name, photo) — logged-in user only
router.put('/me', auth, async (req, res) => {
  try {
    const { name, photo } = req.body;
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof photo === 'string') update.photo = photo;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true }
    ).select('-password');
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        photo: user.photo || ''
      }
    });
  } catch (error) {
    logAndRespond500(res, req, 'PUT /api/auth/me', error);
  }
});

// Change password — logged-in user only
router.post('/me/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logAndRespond500(res, req, 'POST /api/auth/me/change-password', error);
  }
});

module.exports = router;
