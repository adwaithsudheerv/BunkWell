const express = require('express');
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const https = require('https');
const router = express.Router();

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [], day: clientDay, date: clientDate, timezone: clientTz } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const cleanMsg = message.trim();
    const q = cleanMsg.toLowerCase();

    const target = req.user.attendanceTarget || 80;
    const tz = clientTz || 'Asia/Kolkata';

    // 1. Resolve student's local day
    let today = clientDay;
    if (!today) {
      try {
        today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(new Date());
      } catch (e) {
        today = WEEKDAYS[new Date().getDay()];
      }
    }
    const curDayIdx = WEEKDAYS.findIndex(d => d.toLowerCase() === today.toLowerCase());

    // 2. Detect which day the user is asking about (today, tomorrow, day after tomorrow, or specific weekday)
    let targetDay = today;
    let dayLabel = 'today';

    if (q.includes('day after tomorrow') || q.includes('day after 2mrw') || q.includes('day after tmrw')) {
      targetDay = WEEKDAYS[(curDayIdx + 2) % 7];
      dayLabel = `day after tomorrow (${targetDay})`;
    } else if (q.includes('tomorrow') || q.includes('tomorow') || q.includes('2mrw') || q.includes('tmrw')) {
      targetDay = WEEKDAYS[(curDayIdx + 1) % 7];
      dayLabel = `tomorrow (${targetDay})`;
    } else {
      for (const d of WEEKDAYS) {
        if (q.includes(d.toLowerCase())) {
          targetDay = d;
          dayLabel = d;
          break;
        }
      }
    }

    // 3. Fetch student subjects and timetable
    const subjects = await Subject.find({ userId: req.user._id, isActive: true });
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    // 4. Exact Mathematical Safe Bunk Calculation for every subject
    // Formula: Attended / (Total + B) >= (target / 100) => B <= (Attended / (target / 100)) - Total
    const subjectStats = subjects.map(s => {
      const total = s.totalClasses || 0;
      const attended = s.attendedClasses || 0;
      const pct = total > 0 ? (attended / total) * 100 : 100;
      const safeBunks = Math.max(0, Math.floor((attended / (target / 100)) - total));
      const needMore = pct < target ? Math.ceil(((target / 100) * total - attended) / (1 - (target / 100))) : 0;

      return {
        _id: s._id,
        name: s.name,
        code: s.code || '',
        pct: parseFloat(pct.toFixed(1)),
        attended,
        total,
        safeBunksRightNow: safeBunks,
        needToAttendNext: needMore,
        isSafe: pct >= target
      };
    });

    const totalBuffer = subjectStats.reduce((acc, s) => acc + s.safeBunksRightNow, 0);

    // 5. Simulate exact periods scheduled for targetDay
    const targetSchedule = timetable?.days?.find(d => d.day.toLowerCase() === targetDay.toLowerCase());
    const targetPeriods = targetSchedule?.periods || [];

    const periodBreakdown = targetPeriods.map(p => {
      const pNum = p.periodNumber;
      const subName = p.subjectName || p.subjectId?.name || `Period ${pNum}`;
      const subStat = subjectStats.find(s =>
        s.name.toLowerCase() === subName.toLowerCase() ||
        (p.subjectId?._id && String(p.subjectId._id) === String(s._id)) ||
        (p.subjectId && String(p.subjectId) === String(s._id))
      );

      if (!subStat) {
        return {
          periodNumber: pNum,
          subjectName: subName,
          currentPct: 100,
          afterBunkPct: 100,
          safeBunks: 1,
          canBunk: true,
          attended: 0,
          total: 0
        };
      }

      const t = subStat.total;
      const a = subStat.attended;
      const afterBunkPct = t > 0 ? (a / (t + 1)) * 100 : (a / 1) * 100;
      const canBunk = afterBunkPct >= target;

      return {
        periodNumber: pNum,
        subjectName: subStat.name,
        currentPct: subStat.pct,
        afterBunkPct: parseFloat(afterBunkPct.toFixed(1)),
        safeBunks: subStat.safeBunksRightNow,
        canBunk,
        attended: a,
        total: t,
      };
    });

    const safePeriods = periodBreakdown.filter(p => p.canBunk);
    const mustAttendPeriods = periodBreakdown.filter(p => !p.canBunk);

    // Formulate top-level Yes / No verdict
    let verdict = 'NO';
    if (periodBreakdown.length === 0) {
      verdict = `YES (No classes scheduled on ${targetDay}! 🎉)`;
    } else if (mustAttendPeriods.length === 0) {
      verdict = 'YES';
    } else if (safePeriods.length > 0) {
      verdict = 'YES, PARTIALLY (Only for specific safe subjects)';
    } else {
      verdict = 'NO';
    }

    // Direct structured builder
    function buildDirectBunkAnswer() {
      if (periodBreakdown.length === 0) {
        return `**YES**\n\nYou have **no classes scheduled** on ${dayLabel}. You are completely free to take the day off! 🎉`;
      }

      let out = `**${verdict}**\n\n`;

      if (safePeriods.length > 0) {
        out += `### ✅ Subjects you CAN bunk (${dayLabel}):\n`;
        out += safePeriods.map(p =>
          `• **${p.subjectName}** (Period ${p.periodNumber}) — Currently **${p.currentPct}%** ➔ Drops to **${p.afterBunkPct}%** (${p.safeBunks} safe bunk${p.safeBunks === 1 ? '' : 's'} available)`
        ).join('\n');
        out += '\n\n';
      } else {
        out += `### ✅ Subjects you CAN bunk (${dayLabel}):\nNone. All classes require attendance right now.\n\n`;
      }

      if (mustAttendPeriods.length > 0) {
        out += `### ❌ Subjects you CANNOT bunk (Must Attend):\n`;
        out += mustAttendPeriods.map(p =>
          `• **${p.subjectName}** (Period ${p.periodNumber}) — Currently **${p.currentPct}%** ➔ Would drop to **${p.afterBunkPct}%** (below ${target}% target)`
        ).join('\n');
      } else {
        out += `### ❌ Subjects you CANNOT bunk:\nNone. All scheduled periods are safe!`;
      }

      return out;
    }

    // 6. Check if user is asking about bunking
    const isBunkQuestion = q.includes('bunk') || q.includes('skip') || q.includes('can i') ||
                           q.includes('leave') || q.includes('miss') || q.includes('holiday');

    // System prompt for natural conversational AI
    const systemPrompt = `You are BunkBot, a direct, concise, and smart college attendance assistant for BunkClub.
CRITICAL INSTRUCTIONS:
1. When asked if the student can bunk (${dayLabel}), answer directly without long essays, preambles, or fluff:
   - Start immediately with a clear bold verdict: "**YES**", "**NO**", or "**YES, PARTIALLY**".
   - List "### ✅ Subjects you CAN bunk (${dayLabel}):" with period number, current percentage, and percentage after bunking.
   - List "### ❌ Subjects you CANNOT bunk (Must Attend):" with period number, current percentage, and reason.
2. If asked about tomorrow, analyze tomorrow's schedule (${WEEKDAYS[(curDayIdx + 1) % 7]}).
3. If asked about day after tomorrow, analyze (${WEEKDAYS[(curDayIdx + 2) % 7]}).
4. If asked general questions (e.g. attendance of a specific subject, total safe bunks, or simple greetings), answer directly and concisely in 1-3 sentences.
5. Do NOT give long generic speeches, pre-scripted essays, or irrelevant lectures.

Live Mathematical Context for ${dayLabel}:
- Target Day: ${targetDay} (${dayLabel})
- Student Target: ${target}%
- Total Safe Bunks across all subjects: ${totalBuffer}
- Calculated Verdict: ${verdict}
- Periods CAN bunk: ${safePeriods.map(p => `P${p.periodNumber} (${p.subjectName}: ${p.currentPct}% -> ${p.afterBunkPct}%)`).join(', ') || 'None'}
- Periods CANNOT bunk: ${mustAttendPeriods.map(p => `P${p.periodNumber} (${p.subjectName}: ${p.currentPct}% -> ${p.afterBunkPct}%)`).join(', ') || 'None'}
- All Subjects: ${JSON.stringify(subjectStats.map(s => ({ name: s.name, pct: s.pct, safeBunks: s.safeBunksRightNow })))}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-4).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
      { role: 'user', content: cleanMsg }
    ];

    // 7. Try Generative LLM
    try {
      const postData = JSON.stringify({
        messages,
        model: 'openai',
        temperature: 0.6
      });

      const aiReply = await new Promise((resolve, reject) => {
        const apiReq = https.request({
          hostname: 'text.pollinations.ai',
          path: '/openai/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 8000
        }, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (res.statusCode === 200 && parsed.choices?.[0]?.message?.content) {
                resolve(parsed.choices[0].message.content);
              } else {
                reject(new Error(`AI returned status ${res.statusCode}`));
              }
            } catch (e) {
              reject(e);
            }
          });
        });

        apiReq.on('error', reject);
        apiReq.on('timeout', () => {
          apiReq.destroy();
          reject(new Error('AI request timed out'));
        });
        apiReq.write(postData);
        apiReq.end();
      });

      return res.json({
        reply: aiReply,
        provider: 'BunkBot AI'
      });

    } catch (aiErr) {
      console.warn('AI fallback to deterministic engine:', aiErr.message);

      // 8. Deterministic Direct Engine (Zero latency, direct Yes/No breakdown)
      if (isBunkQuestion) {
        return res.json({
          reply: buildDirectBunkAnswer(),
          provider: 'BunkBot AI'
        });
      }

      // Specific subject inquiries
      const foundSub = subjectStats.find(s => q.includes(s.name.toLowerCase()));
      if (foundSub) {
        const reply = `**${foundSub.name}**:\n` +
          `• Current Attendance: **${foundSub.pct}%** (${foundSub.attended}/${foundSub.total} classes)\n` +
          `• Safe Cushion: **${foundSub.safeBunksRightNow} safe bunks**\n` +
          (foundSub.safeBunksRightNow > 0
            ? `Verdict: **Safe to bunk** without dropping below your ${target}% target.`
            : `Verdict: **Must attend** (need +${foundSub.needToAttendNext} class${foundSub.needToAttendNext === 1 ? '' : 'es'} to reach ${target}%).`);
        return res.json({ reply, provider: 'BunkBot AI' });
      }

      if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
        return res.json({
          reply: `Hey! I'm ready. Ask me: *"Can I bunk today?"*, *"Can I bunk tomorrow?"*, or check any specific subject.`,
          provider: 'BunkBot AI'
        });
      }

      return res.json({
        reply: `You currently have **${totalBuffer} safe bunks** in total across your subjects (Target: ${target}%).\n\nAsk me *"Can I bunk today?"* or *"Can I bunk tomorrow?"* for an exact subject breakdown!`,
        provider: 'BunkBot AI'
      });
    }

  } catch (err) {
    console.error('BunkBot error:', err);
    res.status(500).json({ message: 'BunkBot error: ' + err.message });
  }
});

module.exports = router;
