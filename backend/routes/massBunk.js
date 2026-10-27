const express = require('express');
const auth = require('../middleware/auth');
const MassBunkPoll = require('../models/MassBunkPoll');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Subject = require('../models/Subject');
const AttendanceRecord = require('../models/AttendanceRecord');
const router = express.Router();

// 1. GET ACTIVE MASS BUNK POLLS
router.get('/active', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const polls = await MassBunkPoll.find({
      $or: [{ date: today }, { status: 'voting' }]
    })
      .populate('creator', 'username avatar')
      .sort({ createdAt: -1 });

    res.json({ polls });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. INITIATE A NEW MASS BUNK POLL (Pushes directly into group chat)
router.post('/create', auth, async (req, res) => {
  try {
    const { subjectName, periodNumber, date, reason } = req.body;
    if (!subjectName || !reason) {
      return res.status(400).json({ message: 'Subject name and reason are required' });
    }

    const todayStr = date || new Date().toISOString().split('T')[0];

    // Find the default college group chat
    let group = await Conversation.findOne({ isDefaultGroup: true });
    if (!group) {
      group = await Conversation.findOne({ isGroup: true });
    }

    const poll = new MassBunkPoll({
      conversationId: group ? group._id : null,
      creator: req.user._id,
      creatorName: req.user.username,
      subjectName: subjectName.trim(),
      periodNumber: parseInt(periodNumber, 10) || 1,
      date: todayStr,
      reason: reason.trim(),
      votes: [
        {
          userId: req.user._id,
          username: req.user.username,
          choice: 'bunk',
          votedAt: new Date()
        }
      ],
      status: 'voting'
    });

    await poll.save();

    // If group exists, post a message with this poll into the chat stream
    if (group) {
      const pollMessage = new Message({
        conversationId: group._id,
        sender: req.user._id,
        senderName: req.user.username,
        content: `🚨 MASS BUNK PROPOSAL: ${subjectName} (P${poll.periodNumber})! Reason: "${reason}" - Vote below!`,
        type: 'poll',
        pollId: poll._id,
        readBy: [req.user._id],
        encrypted: true
      });
      await pollMessage.save();

      group.lastMessage = {
        content: `🚨 Mass Bunk Poll for ${subjectName}`,
        senderName: req.user.username,
        createdAt: new Date()
      };
      group.updatedAt = new Date();
      await group.save();
    }

    res.json({
      success: true,
      message: `🚨 Mass bunk initiated for ${subjectName}! Pushed to class chat.`,
      poll
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. VOTE ON MASS BUNK POLL
router.post('/vote', auth, async (req, res) => {
  try {
    const { pollId, choice } = req.body; // 'bunk' | 'attend' | 'neutral'
    if (!pollId || !['bunk', 'attend', 'neutral'].includes(choice)) {
      return res.status(400).json({ message: 'Valid pollId and choice required' });
    }

    const poll = await MassBunkPoll.findById(pollId);
    if (!poll) return res.status(404).json({ message: 'Mass bunk poll not found' });

    // Remove previous vote if any
    const existingIndex = poll.votes.findIndex(v => String(v.userId) === String(req.user._id));
    if (existingIndex > -1) {
      poll.votes.splice(existingIndex, 1);
    }

    poll.votes.push({
      userId: req.user._id,
      username: req.user.username,
      choice,
      votedAt: new Date()
    });

    // Re-evaluate consensus status
    const totalVotes = poll.votes.length;
    const bunkVotes = poll.votes.filter(v => v.choice === 'bunk').length;
    const attendVotes = poll.votes.filter(v => v.choice === 'attend').length;
    const bunkPercent = totalVotes > 0 ? (bunkVotes / totalVotes) * 100 : 0;

    if (totalVotes >= 2) {
      if (bunkPercent >= poll.thresholdPercent) {
        poll.status = 'passed';
      } else if (attendVotes > bunkVotes) {
        poll.status = 'failed';
      } else {
        poll.status = 'voting';
      }
    }

    await poll.save();

    res.json({
      success: true,
      message: choice === 'bunk' ? 'Voted to Bunk! 🔥 Solid class solidarity.' : 'Voted to Attend! 🤓 Traitor radar activated.',
      poll
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. 1-TAP APPLY MASS BUNK TO USER ATTENDANCE
router.post('/apply', auth, async (req, res) => {
  try {
    const { pollId } = req.body;
    const poll = await MassBunkPoll.findById(pollId);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });

    // Find subject matching poll subjectName for this user
    const subject = await Subject.findOne({
      userId: req.user._id,
      name: { $regex: new RegExp(poll.subjectName, 'i') }
    });

    if (!subject) {
      return res.status(404).json({ message: `No enrolled subject matching "${poll.subjectName}"` });
    }

    const todayDate = new Date();
    const startOfDay = new Date(todayDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(todayDate); endOfDay.setHours(23, 59, 59, 999);

    let record = await AttendanceRecord.findOne({
      userId: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      periodNumber: poll.periodNumber
    });

    if (record) {
      record.status = 'absent';
      record.notes = `Mass Bunk executed by class: "${poll.reason}"`;
      await record.save();
    } else {
      record = new AttendanceRecord({
        userId: req.user._id,
        subjectId: subject._id,
        date: todayDate,
        periodNumber: poll.periodNumber,
        status: 'absent',
        notes: `Mass Bunk executed by class: "${poll.reason}"`,
        markedAt: todayDate
      });
      await record.save();
    }

    res.json({
      success: true,
      message: `Mass bunk applied for ${subject.name}! Class recorded as bunked. 🚨`,
      record
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
