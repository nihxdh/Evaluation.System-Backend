const express = require('express');
const jwt = require('jsonwebtoken');
const Student = require('../models/student');
const { studentAuth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Register student
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, year } = req.body;
    
    // Validate year
    const validYears = ['1st', '2nd', '3rd', '4th'];
    if (!validYears.includes(year)) {
      return res.status(400).json({ message: 'Year must be one of: 1st, 2nd, 3rd, 4th' });
    }

    // Check if name or email already exists
    const existingStudent = await Student.findOne({ 
      $or: [{ name }, { email }]
    });
    
    if (existingStudent) {
      return res.status(400).json({ 
        message: existingStudent.name === name ? 'Name already taken' : 'Email already registered'
      });
    }

    const student = new Student({ 
      name, 
      email, 
      password,
      year: year 
    });
    await student.save();

    const token = jwt.sign({ 
      userId: student._id,
      isAdmin: false,
      name: student.name
    }, process.env.JWT_SECRET);
    
    res.status(201).json({ 
      token,
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        year: student.year,
        isAdmin: false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login student
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    // Prevent login if trying to use admin credentials
    if (name === process.env.ADMIN_USERNAME) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const student = await Student.findOne({ name });
    if (!student || !(await student.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate student token - never include admin flag
    const token = jwt.sign({ 
      userId: student._id,
      name: student.name,
      isAdmin: false
    }, process.env.JWT_SECRET);
    
    res.json({ 
      token,
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        year: student.year,
        isAdmin: false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student profile
router.get('/profile', studentAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.student._id).select('-password');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student profile
router.put('/profile/:studentId', studentAuth, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.student._id,
      req.body,
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

// Delete student (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await student.deleteOne();
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ 
      message: error.message || 'Error deleting student' 
    });
  }
});

module.exports = router; 