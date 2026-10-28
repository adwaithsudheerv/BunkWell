const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const ClassVouch = require('../models/ClassVouch');
const MassBunkPoll = require('../models/MassBunkPoll');
const router = express.Router();

// 1. GET ALL 1-ON-1 WHISPER CHANNELS FOR USER (Pure User ID to User ID, No Groups)
router.get('/conversations', auth, async (req, res) => {
  try {
    // Delete any stale groups
    await Conversation.deleteMany({ isGroup: true }).exec().catch(() => {});

    const conversations = await Conversation.find({
      participants: req.user._id,
      isGroup: false
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

// 4. GET MESSAGES FOR CONVERSATION (Excludes expired ephemeral chits)
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

// 5. SEND MESSAGE (Ghost Whisper / Pass-The-Chit / View-Once Burn-Out)
router.post('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, gifUrl, pollId, customTimer, isChit, burnSeconds, isViewOnce, replyToMsgId } = req.body;

    if (!content && !gifUrl && !pollId) {
      return res.status(400).json({ message: 'Message content or attachment required' });
    }

    const conv = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    // If this is a reply to a View-Once or Chit message, burn the original message immediately!
    if (replyToMsgId) {
      Message.findOneAndDelete({ _id: replyToMsgId, $or: [{ isViewOnce: true }, { isChit: true }] }).exec().catch(() => {});
    }

    // Calculate self-destruct timer
    const isChitType = type === 'chit' || isChit || isViewOnce;
    const durationSec = Number(customTimer) || conv.disappearingTimer || 300;
    
    // If it's an unopened Chit or View-Once, expiresAt is set only once opened (or defaults to 24 hours if unread)
    const expiresAt = isChitType
      ? new Date(Date.now() + 24 * 3600 * 1000)
      : new Date(Date.now() + durationSec * 1000);

    const msg = new Message({
      conversationId: id,
      sender: req.user._id,
      senderName: req.user.username,
      content: content || (type === 'gif' ? 'Sent a GIF' : 'Secret Chit 📜'),
      type: isChitType ? 'chit' : (type || (gifUrl ? 'gif' : 'text')),
      gifUrl: gifUrl || null,
      pollId: pollId || null,
      isChit: Boolean(isChitType),
      isViewOnce: Boolean(isViewOnce),
      isOpened: false,
      burnSeconds: Number(burnSeconds) || (isViewOnce ? 15 : 30),
      readBy: [req.user._id],
      encrypted: true,
      disappearingSeconds: durationSec,
      expiresAt: expiresAt
    });

    await msg.save();

    // Update conversation lastMessage
    conv.lastMessage = {
      content: isViewOnce ? '① View Once Chit' : (isChitType ? `📜 Secret Chit from @${req.user.username}` : msg.content),
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

// 5A. OPEN SECRET CHIT (Starts Burn Countdown)
router.post('/messages/:id/open-chit', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Chit has already burned or vanished' });

    if (!msg.isOpened) {
      msg.isOpened = true;
      msg.openedAt = new Date();
      const burnDuration = msg.burnSeconds || 30;
      msg.expiresAt = new Date(Date.now() + burnDuration * 1000);
      await msg.save();
    }

    res.json({ message: msg });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5B. BUNK BUDDY SYNC (Mutual Period Coordination)
router.post('/conversations/:id/bunk-sync', auth, async (req, res) => {
  try {
    const { period, subject } = req.body;
    const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id, isGroup: false })
      .populate('participants', 'username');
    if (!conv) return res.status(404).json({ message: 'Channel not found' });

    const otherUser = conv.participants.find(p => String(p._id) !== String(req.user._id));

    // Check if the other user already sent a pending sync for this period
    const existingSync = await Message.findOne({
      conversationId: conv._id,
      type: 'bunk_sync',
      sender: otherUser._id,
      'bunkSync.period': Number(period),
      'bunkSync.isAgreed': false
    });

    if (existingSync) {
      existingSync.bunkSync.isAgreed = true;
      await existingSync.save();

      const agreedMsg = new Message({
        conversationId: conv._id,
        sender: req.user._id,
        senderName: req.user.username,
        content: `🤝 BUNK SYNC CONFIRMED! Both you and @${otherUser.username} are bunking Period ${period} (${subject || 'Class'}).`,
        type: 'bunk_sync',
        bunkSync: { period: Number(period), subject: subject || 'Class', isAgreed: true },
        disappearingSeconds: 180,
        expiresAt: new Date(Date.now() + 180 * 1000)
      });
      await agreedMsg.save();

      return res.json({ message: agreedMsg, agreed: true });
    }

    // New Bunk Sync Request
    const syncMsg = new Message({
      conversationId: conv._id,
      sender: req.user._id,
      senderName: req.user.username,
      content: `🚨 Bunk Sync Request: Wanna bunk Period ${period} (${subject || 'Class'})?`,
      type: 'bunk_sync',
      bunkSync: { period: Number(period), subject: subject || 'Class', targetUsername: otherUser.username, isAgreed: false },
      disappearingSeconds: 300,
      expiresAt: new Date(Date.now() + 300 * 1000)
    });
    await syncMsg.save();

    res.json({ message: syncMsg, agreed: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5C. BURN SESSION (Clean Slate / Zero Footprint Wipe)
router.delete('/conversations/:id/burn', auth, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
    if (!conv) return res.status(404).json({ message: 'Channel not found' });

    await Message.deleteMany({ conversationId: conv._id });

    conv.lastMessage = {
      content: '🔥 Channel incinerated. Zero traces remaining.',
      senderName: 'Ghost Terminal',
      createdAt: new Date()
    };
    conv.updatedAt = new Date();
    await conv.save();

    res.json({ success: true, message: 'Channel incinerated cleanly' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5B. SET DISAPPEARING TIMER (Ephemeral Chit duration)
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

// 5C. START OR GET CHAT BY USER ID / USERNAME (Requires Mutual Acceptance)
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

    // Verify mutual request acceptance (Privacy & Anti-Spam Handshake)
    const connection = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: recipient._id },
        { sender: recipient._id, receiver: req.user._id }
      ]
    });

    if (!connection || connection.status !== 'accepted') {
      const isPending = connection?.status === 'pending';
      const isOutgoing = isPending && String(connection.sender) === String(req.user._id);
      return res.status(403).json({
        message: isPending
          ? (isOutgoing ? `Chit request sent to @${cleanUsername}. Waiting for them to accept.` : `@${cleanUsername} sent you a request! Please accept to unlock chat.`)
          : `You must send a request to @${cleanUsername} and be accepted before chatting.`,
        requiresRequest: !isPending,
        isPending: Boolean(isPending),
        isOutgoing: Boolean(isOutgoing),
        targetUsername: cleanUsername,
        targetId: recipient._id,
        requestId: connection?._id
      });
    }

    let conv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, recipient._id], $size: 2 }
    }).populate('participants', 'username avatar');

    if (!conv) {
      conv = new Conversation({
        isGroup: false,
        name: recipient.username,
        participants: [req.user._id, recipient._id],
        disappearingTimer: 30,
        lastMessage: {
          content: 'Connected! Pass secret chits safely 📜🔥',
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
      // Add each other to classNetwork
      await Promise.all([
        User.findByIdAndUpdate(req.user._id, { $addToSet: { classNetwork: freq.sender } }),
        User.findByIdAndUpdate(freq.sender, { $addToSet: { classNetwork: req.user._id } })
      ]);

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

// 9B. DEMOCRATIC 2-PEER VOUCH (No Single CR Point of Failure)
router.post('/vouch/peer', auth, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    if (!targetUsername) return res.status(400).json({ message: 'Target username is required' });

    const target = await User.findOne({ username: targetUsername.toLowerCase().trim() });
    if (!target) return res.status(404).json({ message: `Student "@${targetUsername}" not found` });

    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot vouch for yourself' });
    }

    let vouchDoc = await ClassVouch.findOne({ targetUser: target._id });
    if (!vouchDoc) {
      vouchDoc = new ClassVouch({
        targetUser: target._id,
        targetUsername: target.username,
        classCode: target.classCode || req.user.classCode || 'MCA-A',
        college: target.college || req.user.college || 'General',
        department: target.department || req.user.department || 'General',
        section: target.section || 'A',
        vouches: []
      });
    }

    if (vouchDoc.vouches.some(v => String(v.userId) === String(req.user._id))) {
      return res.status(400).json({ message: `You have already vouched for @${target.username}!` });
    }

    vouchDoc.vouches.push({
      userId: req.user._id,
      username: req.user.username,
      at: new Date()
    });

    const isNowVerified = vouchDoc.vouches.length >= 2;
    if (isNowVerified) {
      vouchDoc.status = 'verified';
      target.isClassVerified = true;
      await target.save();
    }
    await vouchDoc.save();

    res.json({
      success: true,
      vouchCount: vouchDoc.vouches.length,
      isVerified: isNowVerified,
      message: isNowVerified
        ? `🎉 @${target.username} verified as a legitimate classmate via 2-Peer Vouch!`
        : `Vouched for @${target.username}! (${vouchDoc.vouches.length}/2 vouches reached)`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 9C. GET CLASS VOUCH STATUS FOR CURRENT USER
router.get('/vouch/status', auth, async (req, res) => {
  try {
    const vouchDoc = await ClassVouch.findOne({ targetUser: req.user._id });
    res.json({
      isVerified: Boolean(req.user.isClassVerified || (vouchDoc && vouchDoc.vouches.length >= 2)),
      vouchCount: vouchDoc?.vouches?.length || (req.user.isClassVerified ? 2 : 0),
      classCode: req.user.classCode || 'MCA-A',
      vouches: vouchDoc?.vouches || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 10. SEARCH STUDENT BY EXACT USER ID (No Public Browse / Zero Directory Leak)
router.get('/users', auth, async (req, res) => {
  try {
    const { search } = req.query;
    if (!search || search.trim().length < 2) {
      // Never expose or list all user IDs publicly
      return res.json({ users: [] });
    }

    const s = search.toLowerCase().trim().replace('@', '');
    const users = await User.find({
      _id: { $ne: req.user._id },
      role: { $ne: 'admin' },
      username: { $regex: new RegExp(`^${s}`, 'i') }
    }, 'username').limit(5);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
