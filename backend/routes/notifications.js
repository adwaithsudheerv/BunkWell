const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const webpush = require('web-push');
const router = express.Router();

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  const pubKey = process.env.VAPID_PUBLIC_KEY || 'BEvkdILThIec0RXS_ytPKEww_lzbOWPHAW3ID17xahKDSq6TzD_yo4zMy6CTsYHox3iszF_bOYndmG_nBGXbfwQ';
  res.json({ publicKey: pubKey });
});

// Save push subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ message: 'Subscription required' });

    const user = await User.findById(req.user._id);
    // Avoid duplicates
    const exists = user.pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }
    res.json({ message: 'Subscribed to push notifications' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Unsubscribe
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const user = await User.findById(req.user._id);
    user.pushSubscriptions = user.pushSubscriptions.filter(s => s.endpoint !== endpoint);
    await user.save();
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send test notification
router.post('/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.pushSubscriptions.length) {
      return res.status(400).json({ message: 'No push subscriptions found' });
    }
    const payload = JSON.stringify({
      title: '🎓 BunkClub Test',
      body: 'Push notifications are working! ✅',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    for (const sub of user.pushSubscriptions) {
      try { await webpush.sendNotification(sub, payload); } catch (e) { /* ignore stale */ }
    }
    res.json({ message: 'Test notification sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get latest app version info for in-app updates
router.get('/version', (req, res) => {
  res.json({
    latestVersion: '1.4.3',
    versionCode: 20,
    releaseDate: '2026-10-28',
    downloadUrl: 'https://bunkwell.onrender.com/BunkClub.apk',
    title: '🛡️ BunkClub v1.4.3 Class Isolation & Privacy Edition',
    message: 'College & Section isolation for Mass Bunks, 2-way Chit Handshake, and Democratic 2-Peer Vouching!',
    changelog: [
      '🏫 College & Section Isolation: Mass bunks are strictly scoped to your specific College + Department + Section (Zero cross-college confusion)',
      '🔒 Private Chit Handshake: No public user directories; 1-on-1 chats unlock only after mutual request acceptance',
      '👥 Democratic 2-Peer Vouch: 2 classmates vouch to verify membership — zero dependency on lazy or irresponsible CRs',
      '📜 Pass-The-Chit Secret Notes: Classroom notes that unfold on tap and self-destruct with a burn timer',
      '🤝 Bunk Buddy Sync: 1-tap period sync pings to coordinate bunks directly with trusted classmates'
    ]
  });
});

// Broadcast update notification to all registered devices
router.post('/broadcast-update', async (req, res) => {
  try {
    const users = await User.find({ 'pushSubscriptions.0': { $exists: true } });
    const payload = JSON.stringify({
      title: '🚀 BunkClub v1.3.0 Final Master Release Available',
      body: 'Single-choice attendance reconciliation, holiday toggle, smart login & clean UI ready. Tap to update!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: 'https://bunkwell.onrender.com/BunkClub.apk'
      }
    });

    let sentCount = 0;
    for (const u of users) {
      for (const sub of (u.pushSubscriptions || [])) {
        try {
          await webpush.sendNotification(sub, payload);
          sentCount++;
        } catch (e) {
          // ignore stale subscription
        }
      }
    }
    res.json({ success: true, message: `Update broadcast dispatched to ${sentCount} device(s)`, sentCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
