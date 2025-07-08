const express = require('express');
const Student = require('../models/student');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const { adminAuth } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Admin Login (using env credentials only)
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    // Direct comparison with environment variables - ONLY way to login as admin
    if (name !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Generate token with admin flag
    const token = jwt.sign(
      { 
        isAdmin: true,
        name: process.env.ADMIN_USERNAME
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      isAdmin: true,
      name: process.env.ADMIN_USERNAME
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all students
router.get('/students', adminAuth, async (req, res) => {
  try {
    const students = await Student.find().select('-password');
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new student
router.post('/students', adminAuth, async (req, res) => {
  try {
    const { name, email, year, password } = req.body;
    
    // Check if name or email already exists
    const existingStudent = await Student.findOne({ 
      $or: [{ name }, { email }]
    });
    
    if (existingStudent) {
      return res.status(400).json({ 
        message: existingStudent.name === name ? 'Name already taken' : 'Email already registered'
      });
    }

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long'
      });
    }

    const student = new Student({ 
      name, 
      email, 
      password,
      year 
    });
    
    await student.save();
    
    // Return student data without password
    const studentData = student.toObject();
    delete studentData.password;
    
    res.status(201).json(studentData);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already exists` 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student
router.put('/students/:studentId', adminAuth, async (req, res) => {
  try {
    const { name, email, year, password } = req.body;
    
    // Check if name or email already exists for other students
    const existingStudent = await Student.findOne({ 
      _id: { $ne: req.params.studentId },
      $or: [{ name }, { email }]
    });
    
    if (existingStudent) {
      return res.status(400).json({ 
        message: existingStudent.name === name ? 'Name already taken' : 'Email already registered'
      });
    }

    // Create update object
    const updateData = { name, email, year };
    
    // Only include password if it's provided and valid
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ 
          message: 'Password must be at least 6 characters long'
        });
      }
      updateData.password = password;
    }

    const student = await Student.findByIdAndUpdate(
      req.params.studentId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already exists` 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete student
router.delete('/students/:studentId', adminAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    await Student.findByIdAndDelete(req.params.studentId);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router; 