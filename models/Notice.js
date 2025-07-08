const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'academic', 'event', 'holiday'],
    default: 'general'
  }
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema); 