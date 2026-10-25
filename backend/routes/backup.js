const express = require('express');
const auth = require('../middleware/auth');
const { lockAndSnapshot, unlockAndRestoreIfEmpty } = require('../services/dbPersistence');
const router = express.Router();

// Manual Lock & Snapshot before update
router.post('/lock', auth, async (req, res) => {
  try {
    const snapshot = await lockAndSnapshot();
    res.json({
      message: 'Database locked and persistent snapshot created successfully 🔒',
      snapshot: {
        lockedAt: snapshot.lockedAt,
        counts: snapshot.counts
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to lock database: ' + err.message });
  }
});

// Manual Unlock & Restore after update
router.post('/unlock', auth, async (req, res) => {
  try {
    const result = await unlockAndRestoreIfEmpty();
    res.json({
      message: 'Database unlocked and restored 🔓',
      result
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to unlock database: ' + err.message });
  }
});

// Export full backup JSON
router.get('/export', auth, async (req, res) => {
  try {
    const snapshot = await lockAndSnapshot();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=bunkclub_backup_${Date.now()}.json`);
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    res.status(500).json({ message: 'Failed to export backup: ' + err.message });
  }
});

module.exports = router;
