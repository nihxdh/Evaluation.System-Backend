const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  targetYear: {
    type: String,
    required: true,
    trim: true,
    enum: ['1st', '2nd', '3rd', '4th'],
    default: 'null'
  },
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    fileName: String,
    originalName: String,
    submittedAt: {
      type: Date,
      default: Date.now
    },
    grade: {
      type: Number,
      default: null
    },
    feedback: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['submitted', 'graded'],
      default: 'submitted'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Assignment', assignmentSchema); 