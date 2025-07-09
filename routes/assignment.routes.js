const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const { adminAuth, studentAuth } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
    }
  }
});

// Create new assignment (admin only)
router.post('/upload', adminAuth, async (req, res) => {
  try {
    const { title, description, dueDate, targetYear } = req.body;

    // Validate required fields
    if (!title || !description || !dueDate || !targetYear) {
      return res.status(400).json({ 
        message: 'Missing required fields. Please provide title, description, dueDate, and targetYear.' 
      });
    }

    // Validate targetYear
    const validYears = ['1st', '2nd', '3rd', '4th'];
    if (!validYears.includes(targetYear)) {
      return res.status(400).json({ 
        message: 'Target year must be one of: 1st, 2nd, 3rd, 4th.' 
      });
    }

    const assignment = new Assignment({
      title: title.trim(),
      description,
      dueDate: new Date(dueDate),
      targetYear: targetYear
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Assignment creation error:', error);
    res.status(500).json({ 
      message: 'Error creating assignment',
      error: error.message 
    });
  }
});

// Get all assignments (admin)
router.get('/all', adminAuth, async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate('submissions.student', 'name email year')
      .sort({ createdAt: -1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student assignments
router.get('/', studentAuth, async (req, res) => {
  try {
    // Get student's year
    const studentYear = req.student.year;
    
    const assignments = await Assignment.find({ targetYear: studentYear })
      .populate('submissions.student', 'name email year')
      .sort({ createdAt: -1 });

    // Transform assignments to include submission status for the current student
    const transformedAssignments = assignments.map(assignment => {
      const submission = assignment.submissions.find(
        sub => sub.student._id.toString() === req.student._id.toString()
      );

      return {
        _id: assignment._id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.dueDate,
        targetYear: assignment.targetYear,
        submitted: !!submission,
        fileName: submission?.fileName || null,
        originalName: submission?.originalName || null,
        grade: submission?.grade || null,
        feedback: submission?.feedback || null,
        submittedAt: submission?.submittedAt || null
      };
    });

    res.json(transformedAssignments);
  } catch (error) {
    console.error('Assignment fetch error:', error);
    res.status(500).json({ message: 'Error fetching assignments' });
  }
});

// Submit assignment (student)
router.post('/:id/submit', studentAuth, upload.single('file'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if past due date
    if (new Date(assignment.dueDate) < new Date()) {
      return res.status(400).json({ message: 'Assignment submission deadline has passed' });
    }

    // Check if student has already submitted
    const existingSubmission = assignment.submissions.find(
      sub => sub.student.toString() === req.student._id.toString()
    );

    if (existingSubmission) {
      // Delete old file if it exists
      const oldFilePath = path.join('uploads', existingSubmission.fileName);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
      
      // Update existing submission
      existingSubmission.fileName = req.file.filename;
      existingSubmission.originalName = req.file.originalname;
      existingSubmission.submittedAt = Date.now();
      existingSubmission.grade = null;
      existingSubmission.feedback = null;
      existingSubmission.status = 'submitted';
    } else {
      // Add new submission
      assignment.submissions.push({
        student: req.student._id,
        fileName: req.file.filename,
        originalName: req.file.originalname
      });
    }

    await assignment.save();
    res.json({ message: 'Assignment submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Grade submission (admin only)
router.post('/:id/grade/:submissionId', adminAuth, async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const submission = assignment.submissions.id(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.grade = grade;
    submission.feedback = feedback;
    submission.status = 'graded';

    await assignment.save();
    res.json({ message: 'Submission graded successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download submission - accessible by both admin and students
router.get('/:id/download/:filename', async (req, res) => {
  try {
    // Get and verify token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const isAdmin = decoded.isAdmin && decoded.name === process.env.ADMIN_USERNAME;
    const studentId = !isAdmin ? decoded.userId : null;

    // Find the assignment
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Find the submission
    const submission = assignment.submissions.find(sub => sub.fileName === req.params.filename);
    if (!submission) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Access control
    if (!isAdmin && (!studentId || submission.student.toString() !== studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if file exists
    const filePath = path.join('uploads', req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${submission.originalName || req.params.filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Handle stream errors
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: error.message || 'Error downloading file' });
  }
});

// Fix assignment targetYear inconsistencies (admin only)
router.post('/fix-target-years', adminAuth, async (req, res) => {
  try {
    // Get all assignments
    const allAssignments = await Assignment.find({});
    console.log('Found', allAssignments.length, 'assignments to process');

    let fixedCount = 0;
    const results = [];

    for (const assignment of allAssignments) {
      const originalTargetYear = assignment.targetYear;
      
      // Fix the targetYear based on the current value
      let newTargetYear;
      if (!assignment.targetYear || assignment.targetYear === '') {
        newTargetYear = '1st';
      } else if (assignment.targetYear === '2') {
        newTargetYear = '2nd';
      } else if (assignment.targetYear === '3') {
        newTargetYear = '3rd';
      } else if (assignment.targetYear === '4') {
        newTargetYear = '4th';
      } else if (assignment.targetYear === '1') {
        newTargetYear = '1st';
      } else {
        // If it's already in correct format, keep it
        newTargetYear = assignment.targetYear;
      }
      
      // Only update if there's a change
      if (originalTargetYear !== newTargetYear) {
        assignment.targetYear = newTargetYear;
        await assignment.save();
        fixedCount++;
        
        results.push({
          id: assignment._id,
          title: assignment.title,
          original: originalTargetYear,
          fixed: newTargetYear
        });
      }
    }

    res.json({
      message: `Fixed ${fixedCount} out of ${allAssignments.length} assignments`,
      totalAssignments: allAssignments.length,
      fixedCount: fixedCount,
      results: results
    });

  } catch (error) {
    console.error('Fix assignments error:', error);
    res.status(500).json({ 
      message: 'Error fixing assignments',
      error: error.message 
    });
  }
});

// Delete assignment (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Delete all submitted files
    for (const submission of assignment.submissions) {
      const filePath = path.join('uploads', submission.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await assignment.deleteOne();
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 