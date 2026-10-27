const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const MassBunkPoll = require('../models/MassBunkPoll');
const router = express.Router();

const DEFAULT_GROUP_NAME = '🎓 MCA Section A - Official Bunk Syndicate';
const DEFAULT_GROUP_DESC = 'Official class group chat for bunk coordination, timetable swaps & announcements.';

/**
 * Ensures the default college group exists and has all users enrolled.
 */
async function ensureDefaultCollegeGroup(currentUserId) {
  let defaultGroup = await Conversation.findOne({ isDefaultGroup: true });
  const allUsers = await User.find({ role: { $ne: 'admin' } }, '_id');
  const allUserIds = allUsers.map(u => u._id);

  if (!defaultGroup) {
    defaultGroup = new Conversation({
      isGroup: true,
      name: DEFAULT_GROUP_NAME,
      description: DEFAULT_GROUP_DESC,
      avatar: '🎓',
      isDefaultGroup: true,
      participants: allUserIds,
      lastMessage: {
        content: 'Welcome to BunkClub! Coordinate bunks and discuss classes here. 🔥',
        senderName: 'BunkClub Bot',
        createdAt: new Date()
      }
    });
    await defaultGroup.save();

    // Create welcome message
    const welcomeMsg = new Message({
      conversationId: defaultGroup._id,
      sender: currentUserId,
      senderName: 'BunkClub Bot',
      content: '🚨 Official MCA Section A Bunk Syndicate is live! Use the 🚨 MASS BUNK button to initiate class-wide polls.',
      type: 'system',
      encrypted: true
    });
    await welcomeMsg.save();
  } else {
    // Ensure all active students are in participants list
    const existingSet = new Set(defaultGroup.participants.map(p => String(p)));
    let added = false;
    allUserIds.forEach(uid => {
      if (!existingSet.has(String(uid))) {
        defaultGroup.participants.push(uid);
        added = true;
      }
    });
    if (added) await defaultGroup.save();
  }

  return defaultGroup;
}

// 1. GET ALL CONVERSATIONS FOR USER
router.get('/conversations', auth, async (req, res) => {
  try {
    await ensureDefaultCollegeGroup(req.user._id);

    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'username avatar attendanceTarget')
      .sort({ updatedAt: -1 });

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CREATE OR GET 1-ON-1 CONVERSATION
router.post('/conversations', auth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) return res.status(400).json({ message: 'recipientId is required' });

    if (String(recipientId) === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) return res.status(404).json({ message: 'User not found' });

    // Look for existing 1-on-1 conversation
    let conv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, recipientId], $size: 2 }
    }).populate('participants', 'username avatar');

    if (!conv) {
      conv = new Conversation({
        isGroup: false,
        name: recipient.username,
        participants: [req.user._id, recipientId],
        lastMessage: {
          content: 'Started secure end-to-end chat 🔒',
          senderName: req.user.username,
          createdAt: new Date()
        }
      });
      await conv.save();
      conv = await Conversation.findById(conv._id).populate('participants', 'username avatar');
    }

    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. CREATE GROUP CONVERSATION
router.post('/groups', auth, async (req, res) => {
  try {
    const { name, description, participantIds } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Group name is required' });

    const participants = Array.from(new Set([req.user._id.toString(), ...(participantIds || [])]));

    const group = new Conversation({
      isGroup: true,
      name: name.trim(),
      description: description || 'College Bunk Syndicate',
      avatar: '👥',
      admin: req.user._id,
      participants,
      lastMessage: {
        content: `${req.user.username} created group "${name}"`,
        senderName: 'System',
        createdAt: new Date()
      }
    });

    await group.save();
    const populated = await Conversation.findById(group._id).populate('participants', 'username avatar');
    res.json({ group: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. GET MESSAGES FOR CONVERSATION (Excludes expired Snapchat-style messages)
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const conv = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: 'Conversation not found or access denied' });

    const now = new Date();

    // Background clean up of expired messages
    Message.deleteMany({ conversationId: id, expiresAt: { $lte: now } }).exec().catch(() => {});

    const messages = await Message.find({
      conversationId: id,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }]
    })
      .populate('pollId')
      .sort({ createdAt: 1 })
      .limit(100);

    // Mark as read
    await Message.updateMany(
      { conversationId: id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id }, $set: { isViewed: true } }
    );

    res.json({
      messages,
      disappearingTimer: conv.disappearingTimer || 300
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. SEND MESSAGE (Snapchat Self-Destructing / Disappearing)
router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, gifUrl, pollId, customTimer } = req.body;

    if (!content && !gifUrl && !pollId) {
      return res.status(400).json({ message: 'Message content or attachment required' });
    }

    const conv = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    // Calculate self-destruct timer (Snapchat model)
    const durationSec = Number(customTimer) || conv.disappearingTimer || 300;
    const expiresAt = new Date(Date.now() + durationSec * 1000);

    const msg = new Message({
      conversationId: id,
      sender: req.user._id,
      senderName: req.user.username,
      content: content || (type === 'gif' ? 'Sent a GIF' : 'Sent a Poll'),
      type: type || (gifUrl ? 'gif' : 'text'),
      gifUrl: gifUrl || null,
      pollId: pollId || null,
      readBy: [req.user._id],
      encrypted: true,
      disappearingSeconds: durationSec,
      expiresAt: expiresAt
    });

    await msg.save();

    // Update conversation lastMessage
    conv.lastMessage = {
      content: msg.content,
      senderName: req.user.username,
      createdAt: msg.createdAt
    };
    conv.updatedAt = new Date();
    await conv.save();

    const populatedMsg = await Message.findById(msg._id).populate('pollId');
    res.json({ message: populatedMsg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5B. SET DISAPPEARING TIMER (Snapchat style)
router.post('/conversations/:id/disappearing', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { seconds } = req.body;
    const conv = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    conv.disappearingTimer = Number(seconds) || 300;
    await conv.save();

    res.json({ success: true, disappearingTimer: conv.disappearingTimer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5C. START OR GET CHAT BY USER ID / USERNAME
router.post('/conversations/by-username', auth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) return res.status(400).json({ message: 'User ID is required' });

    const cleanUsername = username.toLowerCase().trim().replace('@', '');
    if (cleanUsername === req.user.username.toLowerCase()) {
      return res.status(400).json({ message: 'Cannot chat with your own User ID' });
    }

    const recipient = await User.findOne({ username: cleanUsername });
    if (!recipient) return res.status(404).json({ message: `Member with User ID "@${cleanUsername}" not found` });

    let conv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, recipient._id], $size: 2 }
    }).populate('participants', 'username avatar');

    if (!conv) {
      conv = new Conversation({
        isGroup: false,
        name: recipient.username,
        participants: [req.user._id, recipient._id],
        disappearingTimer: 300,
        lastMessage: {
          content: 'Started Snapchat-style disappearing chat ⏱️🔥',
          senderName: req.user.username,
          createdAt: new Date()
        }
      });
      await conv.save();
      conv = await Conversation.findById(conv._id).populate('participants', 'username avatar');
    }

    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. TOGGLE EMOJI REACTION ON MESSAGE
router.post('/messages/:id/react', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji required' });

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const existingIdx = message.reactions.findIndex(
      r => String(r.userId) === String(req.user._id) && r.emoji === emoji
    );

    if (existingIdx > -1) {
      message.reactions.splice(existingIdx, 1);
    } else {
      message.reactions.push({
        emoji,
        userId: req.user._id,
        username: req.user.username
      });
    }

    await message.save();
    res.json({ success: true, reactions: message.reactions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. GET FRIENDS & PENDING REQUESTS
router.get('/friends', auth, async (req, res) => {
  try {
    const [accepted, incoming, outgoing] = await Promise.all([
      FriendRequest.find({
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        status: 'accepted'
      }).populate('sender receiver', 'username avatar attendanceTarget'),
      FriendRequest.find({
        receiver: req.user._id,
        status: 'pending'
      }).populate('sender', 'username avatar attendanceTarget'),
      FriendRequest.find({
        sender: req.user._id,
        status: 'pending'
      }).populate('receiver', 'username avatar attendanceTarget')
    ]);

    const friends = accepted.map(reqDoc => {
      const isSender = String(reqDoc.sender._id) === String(req.user._id);
      return isSender ? reqDoc.receiver : reqDoc.sender;
    });

    res.json({ friends, incoming, outgoing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 8. SEND FRIEND REQUEST
router.post('/friends/request', auth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) return res.status(400).json({ message: 'Username is required' });

    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, '');
    if (cleanUsername === req.user.username.toLowerCase()) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
    }

    const targetUser = await User.findOne({ username: cleanUsername });
    if (!targetUser) return res.status(404).json({ message: `User "@${cleanUsername}" not found` });

    const existing = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: targetUser._id },
        { sender: targetUser._id, receiver: req.user._id }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: `You are already connected with @${cleanUsername}!` });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ message: 'A pending request already exists between you two.' });
      }
      existing.status = 'pending';
      existing.sender = req.user._id;
      existing.receiver = targetUser._id;
      await existing.save();
      return res.json({ success: true, message: `Request re-sent to @${cleanUsername}! 💬` });
    }

    const freq = new FriendRequest({
      sender: req.user._id,
      receiver: targetUser._id,
      status: 'pending'
    });
    await freq.save();

    res.json({ success: true, message: `Friend request sent to @${cleanUsername}! 💬` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 9. RESPOND TO FRIEND REQUEST
router.post('/friends/respond', auth, async (req, res) => {
  try {
    const { requestId, action } = req.body; // action: 'accept' | 'reject'
    if (!requestId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Valid requestId and action required' });
    }

    const freq = await FriendRequest.findOne({ _id: requestId, receiver: req.user._id });
    if (!freq) return res.status(404).json({ message: 'Friend request not found' });

    freq.status = action === 'accept' ? 'accepted' : 'rejected';
    await freq.save();

    if (action === 'accept') {
      // Auto-create or find 1-on-1 conversation
      let conv = await Conversation.findOne({
        isGroup: false,
        participants: { $all: [req.user._id, freq.sender], $size: 2 }
      });
      if (!conv) {
        conv = new Conversation({
          isGroup: false,
          participants: [req.user._id, freq.sender],
          lastMessage: {
            content: 'Connected on BunkClub! 🔒',
            senderName: req.user.username,
            createdAt: new Date()
          }
        });
        await conv.save();
      }
    }

    res.json({ success: true, message: action === 'accept' ? 'Request accepted! Chat is open. 🎉' : 'Request declined' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 10. DISCOVER / SEARCH REGISTERED STUDENTS BY USER ID
router.get('/users', auth, async (req, res) => {
  try {
    const { search } = req.query;
    const query = {
      _id: { $ne: req.user._id },
      role: { $ne: 'admin' }
    };

    if (search && search.trim()) {
      const s = search.toLowerCase().trim().replace('@', '');
      query.username = { $regex: new RegExp(s, 'i') };
    }

    const users = await User.find(query, 'username avatar attendanceTarget createdAt').limit(30);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
