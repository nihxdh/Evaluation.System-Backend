const jwt = require('jsonwebtoken');
const Student = require('../models/student');

// Helper function to handle token verification
const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      error.status = 401;
      error.message = 'Token has expired. Please login again.';
    } else if (error.name === 'JsonWebTokenError') {
      error.status = 401;
      error.message = 'Invalid token. Please login again.';
    } else {
      error.status = 500;
      error.message = 'Authentication error. Please try again.';
    }
    throw error;
  }
};

// Generate new access token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Verify student token
const studentAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = verifyToken(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(error.status).json({ 
        message: error.message,
        isExpired: error.name === 'TokenExpiredError'
      });
    }
    
    // For students, we need userId and should not have isAdmin flag
    if (!decoded.userId || decoded.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const student = await Student.findById(decoded.userId);
    if (!student) {
      return res.status(401).json({ message: 'Student not found' });
    }

    // Generate new token if the current one is about to expire (within 5 minutes)
    const tokenExp = decoded.exp * 1000; // Convert to milliseconds
    if (tokenExp - Date.now() < 5 * 60 * 1000) {
      const newToken = generateAccessToken({ 
        userId: student._id,
        name: student.name,
        year: student.year
      });
      res.setHeader('New-Access-Token', newToken);
    }

    req.student = student;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(error.status || 401).json({ message: error.message || 'Authentication failed' });
  }
};

// Verify admin token
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = verifyToken(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(error.status).json({ 
        message: error.message,
        isExpired: error.name === 'TokenExpiredError'
      });
    }
    
    // Strict checks for admin role - MUST match env credentials
    if (!decoded.isAdmin || decoded.name !== process.env.ADMIN_USERNAME) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate new token if the current one is about to expire (within 5 minutes)
    const tokenExp = decoded.exp * 1000; // Convert to milliseconds
    if (tokenExp - Date.now() < 5 * 60 * 1000) {
      const newToken = generateAccessToken({ 
        isAdmin: true,
        name: process.env.ADMIN_USERNAME
      });
      res.setHeader('New-Access-Token', newToken);
    }

    req.admin = {
      name: process.env.ADMIN_USERNAME,
      isAdmin: true
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(error.status || 401).json({ message: error.message || 'Authentication failed' });
  }
};

module.exports = { studentAuth, adminAuth }; 