const express = require('express');
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const https = require('https');
const router = express.Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-2cfa7b2980b6475bb4067a4ab1e9c007';

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const target = req.user.attendanceTarget || 80;
    const semesterMonths = req.user.semesterMonths || 6;
    const monthsElapsed = req.user.monthsElapsed || 2;
    const monthsRemaining = Math.max(0, semesterMonths - monthsElapsed);

    // Fetch user context
    const subjects = await Subject.find({ userId: req.user._id, isActive: true });
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todaySchedule = timetable?.days?.find(d => d.day === today);

    // Build subject calculations
    const subjectStats = subjects.map(s => {
      const total = s.totalClasses || 0;
      const attended = s.attendedClasses || 0;
      const pct = total > 0 ? (attended / total) * 100 : 100;
      const minNeeded = Math.ceil(total * (target / 100));
      const safeBunks = Math.max(0, attended - minNeeded);
      const needMore = pct < target ? Math.ceil(((target / 100) * total - attended) / (1 - (target / 100))) : 0;

      // Count weekly frequency in timetable
      let weeklyFreq = 0;
      if (timetable && timetable.days) {
        timetable.days.forEach(d => {
          (d.periods || []).forEach(p => {
            const pName = p.subjectName || p.subjectId?.name;
            if (pName && pName.toLowerCase() === s.name.toLowerCase()) {
              weeklyFreq++;
            }
          });
        });
      }

      const remainingSemesterClasses = weeklyFreq * 4 * monthsRemaining;
      const lifetimeTotal = total + remainingSemesterClasses;
      const maxLifetimeBunks = Math.floor(lifetimeTotal * (1 - target / 100));
      const usedBunks = Math.max(0, total - attended);
      const futureBunksLeft = Math.max(0, maxLifetimeBunks - usedBunks);

      return {
        name: s.name,
        pct: parseFloat(pct.toFixed(1)),
        attended,
        total,
        safeBunksRightNow: safeBunks,
        needToAttendNext: needMore,
        weeklyClasses: weeklyFreq,
        remainingSemesterClasses,
        futureBunksRemainingAcrossSemester: futureBunksLeft,
        isSafe: pct >= target
      };
    });

    const systemPrompt = `You are BunkBot, an ultra-smart, street-smart college bunking and attendance advisor for the BunkClub app.
You have real-time live access to the student's exact academic profile:
- Attendance Target: ${target}%
- Semester: ${semesterMonths} months total (${monthsElapsed} months elapsed, ${monthsRemaining} months remaining)
- Real-time Subject Attendance & Long-term Forecast:
${JSON.stringify(subjectStats, null, 2)}
- Today's (${today}) Schedule:
${JSON.stringify((todaySchedule?.periods || []).filter(p => p.subjectName).map(p => `P${p.periodNumber} (${p.startTime}): ${p.subjectName}`), null, 2)}

Instructions:
1. Provide direct, witty, highly mathematical and reassuring advice.
2. If they ask if they can bunk, calculate the exact impact on their attendance percentage and say YES or NO clearly.
3. Refer to their long-term semester buffer (${monthsRemaining} months left) so they know if bunking now will cause issues at exam time.
4. Keep answers concise, formatted in clean markdown, with bullet points. No unnecessary waffle.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
      { role: 'user', content: message }
    ];

    // Attempt DeepSeek API Call
    try {
      const postData = JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.6,
        max_tokens: 600
      });

      const deepseekResponse = await new Promise((resolve, reject) => {
        const apiReq = https.request({
          hostname: 'api.deepseek.com',
          path: '/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 10000
        }, res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (res.statusCode >= 200 && res.statusCode < 300 && parsed.choices?.[0]?.message?.content) {
                resolve({ content: parsed.choices[0].message.content, model: 'deepseek-chat' });
              } else {
                reject(new Error(parsed.error?.message || `DeepSeek API returned status ${res.statusCode}`));
              }
            } catch (err) {
              reject(err);
            }
          });
        });

        apiReq.on('error', reject);
        apiReq.on('timeout', () => {
          apiReq.destroy();
          reject(new Error('DeepSeek API request timed out'));
        });
        apiReq.write(postData);
        apiReq.end();
      });

      return res.json({
        reply: deepseekResponse.content,
        provider: 'DeepSeek AI (deepseek-chat)',
        stats: { target, semesterMonths, monthsElapsed, monthsRemaining, subjectStats }
      });

    } catch (deepseekErr) {
      console.warn('DeepSeek API fallback activated:', deepseekErr.message);

      // Intelligent Local BunkBot Fallback: Generates mathematically exact contextual response
      const q = message.toLowerCase();
      let reply = '';

      const totalBuffer = subjectStats.reduce((acc, s) => acc + s.safeBunksRightNow, 0);
      const atRiskSubjects = subjectStats.filter(s => !s.isSafe);
      const safeSubjects = subjectStats.filter(s => s.isSafe && s.safeBunksRightNow > 0);

      if (q.includes('semester') || q.includes('month') || q.includes('last') || q.includes('end') || q.includes('later')) {
        reply = `### 📅 Full-Semester Bunk Forecast (${monthsRemaining} Months Remaining)\n\n` +
          `You have **${monthsRemaining} months** left in your ${semesterMonths}-month semester.\n\n` +
          `**Long-Term Bunk Cushion:**\n` +
          subjectStats.map(s => `• **${s.name}**: ${s.weeklyClasses} classes/week $\\rightarrow$ **${s.remainingSemesterClasses} more classes** scheduled. You can safely bunk **${s.futureBunksRemainingAcrossSemester} classes** across the remaining semester without falling below ${target}%.`).join('\n') +
          `\n\n🎯 **Verdict for Late-Semester Exams:** Bunking **1 or 2 classes now will NOT be an issue at the end** as long as you stay within your future buffer!`;
      } else if (q.includes('today') || q.includes('now') || q.includes('can i bunk') || q.includes('skip')) {
        reply = `### 🎯 Attendance & Bunk Analysis (Target: ${target}%)\n\n` +
          `**Safe to Bunk Right Now:**\n` +
          (safeSubjects.length > 0
            ? safeSubjects.map(s => `• **${s.name}** (${s.pct}%): You have **${s.safeBunksRightNow} safe bunks** right now.`).join('\n')
            : `• *None right now — your subjects are close to the target.*`) +
          `\n\n` +
          (atRiskSubjects.length > 0
            ? `⚠️ **Must Attend:**\n` + atRiskSubjects.map(s => `• **${s.name}** (${s.pct}%): Need **+${s.needToAttendNext} consecutive classes** to reach ${target}%.`).join('\n')
            : `✅ **All subjects are currently on track!**`) +
          `\n\n💡 *Tip: Across your remaining ${monthsRemaining} months, you still have long-term semester buffers!*`;
      } else {
        reply = `### 🤖 BunkBot Strategist\n\n` +
          `Here is your live attendance summary for your **${semesterMonths}-month semester** (${monthsRemaining} months left):\n\n` +
          `• **Overall Target:** ${target}%\n` +
          `• **Immediate Safe Bunks:** ${totalBuffer} classes across subjects\n` +
          `• **Top Buffer Subject:** ${safeSubjects[0]?.name || 'All set'} (${safeSubjects[0]?.safeBunksRightNow || 0} bunks cushion)\n\n` +
          `Ask me anything like:\n` +
          `* *"Can I skip Friday classes?"*\n` +
          `* *"How many classes can I bunk before semester exams in Month ${semesterMonths}?"*\n` +
          `* *"If I bunk 3 classes now, will it be an issue at the last?"*`;
      }

      return res.json({
        reply,
        provider: 'BunkBot AI Engine (Precision Fallback)',
        note: deepseekErr.message.includes('Insufficient Balance')
          ? 'DeepSeek balance top-up available at platform.deepseek.com; fallback precision calculations active.'
          : null,
        stats: { target, semesterMonths, monthsElapsed, monthsRemaining, subjectStats }
      });
    }

  } catch (err) {
    console.error('BunkBot error:', err);
    res.status(500).json({ message: 'BunkBot error: ' + err.message });
  }
});

module.exports = router;
