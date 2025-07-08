const express = require('express');
const Notice = require('../models/Notice');
const { adminAuth } = require('../middleware/auth');
const router = express.Router();

// Create notice (admin only)
router.post('/create', adminAuth, async (req, res) => {
  try {
    const notice = new Notice(req.body);
    await notice.save();
    res.status(201).json(notice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all notices (public)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    
    const notices = await Notice.find(filter)
      .sort('-createdAt');
    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notice (admin only)
router.put('/:noticeId', adminAuth, async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(
      req.params.noticeId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }
    res.json(notice);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notice (admin only)
router.delete('/:noticeId', adminAuth, async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.noticeId);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }
    res.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 