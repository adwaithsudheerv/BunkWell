const express = require('express');
const auth = require('../middleware/auth');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const https = require('https');
const router = express.Router();

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [], day: clientDay, date: clientDate, timezone: clientTz } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const cleanMsg = message.trim();
    const q = cleanMsg.toLowerCase();

    const target = req.user.attendanceTarget || 80;
    const semesterMonths = req.user.semesterMonths || 6;
    const monthsElapsed = req.user.monthsElapsed || 2;
    const monthsRemaining = Math.max(0, semesterMonths - monthsElapsed);
    const cycleType = semesterMonths <= 3 ? 'Trimester' : semesterMonths >= 9 ? 'Academic Year' : 'Semester';

    // 1. Determine local day of student (avoid UTC mismatch on Render)
    const tz = clientTz || 'Asia/Kolkata';
    let today = clientDay;
    if (!today) {
      try {
        today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(new Date());
      } catch (e) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        today = days[new Date().getDay()];
      }
    }

    // 2. Fetch student subjects and active timetable
    const subjects = await Subject.find({ userId: req.user._id, isActive: true });
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    const todaySchedule = timetable?.days?.find(d => d.day.toLowerCase() === today.toLowerCase());

    // 3. High-Precision Mathematical Bunk Calculation
    // Formula for safe bunks:
    // Attended / (Total + B) >= (target / 100)
    // => B <= (Attended / (target / 100)) - Total
    const subjectStats = subjects.map(s => {
      const total = s.totalClasses || 0;
      const attended = s.attendedClasses || 0;
      const pct = total > 0 ? (attended / total) * 100 : 100;

      // Exact mathematical safe bunks
      const safeBunks = Math.max(0, Math.floor((attended / (target / 100)) - total));
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
        code: s.code || '',
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

    const totalBuffer = subjectStats.reduce((acc, s) => acc + s.safeBunksRightNow, 0);
    const atRiskSubjects = subjectStats.filter(s => !s.isSafe);
    const safeSubjects = subjectStats.filter(s => s.isSafe && s.safeBunksRightNow > 0);

    // 4. Period-by-Period Simulation for Today's Timetable
    const todayPeriods = todaySchedule?.periods || [];
    const periodBreakdown = todayPeriods.map(p => {
      const pNum = p.periodNumber;
      const subName = p.subjectName || p.subjectId?.name || `Period ${pNum}`;
      const subStat = subjectStats.find(s =>
        s.name.toLowerCase() === subName.toLowerCase() ||
        (p.subjectId?._id && String(p.subjectId._id) === String(s._id))
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

    const safePeriodsToday = periodBreakdown.filter(p => p.canBunk);
    const mustAttendPeriodsToday = periodBreakdown.filter(p => !p.canBunk);

    const timetableSummaryText = periodBreakdown.length > 0
      ? periodBreakdown.map(p =>
          `• Period ${p.periodNumber}: ${p.subjectName} — Current: ${p.currentPct}% (${p.attended}/${p.total} classes)\n` +
          `  ↳ If bunked today: drops to ${p.afterBunkPct}% ➔ ${p.canBunk ? `SAFE TO BUNK ✅ (${p.safeBunks} safe bunks)` : `MUST ATTEND ❌ (drops below ${target}%)`}`
        ).join('\n')
      : `No classes scheduled in timetable for ${today}.`;

    // 5. System Prompt with Precise Student Context
    const systemPrompt = `You are BunkBot, a classy, witty, and savage college attendance strategist for BunkClub.
Your personality: You are like a super smart, stylish, street-smart college senior who gives funny, classy roasts when students ask silly questions, complain, or have borderline attendance. But you ALWAYS back it up with razor-sharp mathematical attendance precision.
When the student asks whether they can safely bunk today, give a clear, direct, period-by-period answer based on their timetable schedule!

Student's Live Context:
- Today is: ${today}
- Attendance Target: ${target}%
- Academic Cycle: ${semesterMonths} months total (${cycleType}, ${monthsElapsed} months elapsed, ${monthsRemaining} months remaining)
- Total Safe Bunk Buffer across all subjects: ${totalBuffer} classes
- Today's (${today}) Schedule Simulation:
${timetableSummaryText}

Today's Safe Periods to Bunk: ${safePeriodsToday.map(p => `P${p.periodNumber} (${p.subjectName})`).join(', ') || 'None (all are critical)'}
Today's Critical Must-Attend Periods: ${mustAttendPeriodsToday.map(p => `P${p.periodNumber} (${p.subjectName})`).join(', ') || 'None (all are safe)'}

Subjects Overview: ${JSON.stringify(subjectStats.map(s => ({ name: s.name, pct: s.pct, safeBunks: s.safeBunksRightNow, needToAttend: s.needToAttendNext })))}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-4).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
      { role: 'user', content: cleanMsg }
    ];

    // 6. Try High-Speed Generative AI (Pollinations OpenAI engine)
    try {
      const postData = JSON.stringify({
        messages,
        model: 'openai',
        temperature: 0.75
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
          timeout: 9000
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
      console.warn('Generative AI fallback to Timetable & Bunk Analytics Engine:', aiErr.message);

      // 7. Deterministic High-Precision Timetable & Bunk Analytics Engine
      let reply = '';

      const isAskingTodayBunk = q.includes('today') || q.includes('bunk') || q.includes('skip') ||
                               q.includes('period') || q.includes('class') || q.includes('safe') ||
                               q.includes('can i');

      if (isAskingTodayBunk && periodBreakdown.length > 0) {
        reply = `Here is your exact timetable bunk analysis for today (**${today}**) targeting **${target}%**:\n\n` +
          `### 📅 Today's Period Breakdown:\n` +
          periodBreakdown.map(p => {
            if (p.canBunk) {
              return `• **Period ${p.periodNumber}: ${p.subjectName}** — Current: **${p.currentPct}%** (${p.attended}/${p.total})\n` +
                     `  ↳ If bunked today: drops to **${p.afterBunkPct}%** ➔ **SAFE TO BUNK ✅** (${p.safeBunks} safe bunks left)`;
            } else {
              return `• **Period ${p.periodNumber}: ${p.subjectName}** — Current: **${p.currentPct}%** (${p.attended}/${p.total})\n` +
                     `  ↳ If bunked today: drops to **${p.afterBunkPct}%** ➔ **MUST ATTEND ❌** (would fall below ${target}%)`;
            }
          }).join('\n\n') +
          `\n\n### 🎯 BunkBot Verdict:\n` +
          (safePeriodsToday.length > 0
            ? `You can easily and safely bunk **${safePeriodsToday.map(p => `Period ${p.periodNumber} (${p.subjectName})`).join(' or ')}** today! Enjoy your break guilt-free. ☕✨\n\n` +
              (mustAttendPeriodsToday.length > 0
                ? `⚠️ **Strictly attend:** ${mustAttendPeriodsToday.map(p => `**Period ${p.periodNumber} (${p.subjectName})**`).join(', ')} so your percentage stays above ${target}%.`
                : `All your periods today have safe cushion!`)
            : `⚠️ **Warning:** None of today's periods have a safe bunk cushion right now. You need to attend today's classes to build your buffer before taking time off! 📚`);
      } else if (isAskingTodayBunk && periodBreakdown.length === 0) {
        reply = `Looking at your timetable for **${today}**, you have **no scheduled classes** today! 🎉\n\n` +
          `You have a total of **${totalBuffer} safe bunks** accumulated across your registered subjects for the rest of the week.`;
      } else if (q.includes('are you mad') || q.includes('crazy') || q.includes('stupid') || q.includes('shut up')) {
        reply = `Me, mad? 💀 Darling, your attendance target is **${target}%**, you currently have **${totalBuffer} safe bunks** in reserve, and you're questioning MY mental stability?\n\n` +
          `I'm doing calculus so you don't end up detained by your HOD. Sit down, sip your coffee, and let's calculate your schedule like civilized scholars. 💅`;
      } else if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
        reply = `Hey there! 👋 I'm locked into your **${today}** schedule and your **${target}% attendance target**.\n\n` +
          `Today you have **${periodBreakdown.length} classes scheduled**, and you have **${totalBuffer} safe bunks** across all subjects.\n\n` +
          `Want to know which specific period you can skip today, or plan a long weekend?`;
      } else {
        reply = `Here is your current academic summary for **${today}**:\n\n` +
          `• **Attendance Target:** ${target}%\n` +
          `• **Immediate Safe Cushion:** **${totalBuffer} classes** total\n` +
          `• **Today's Classes:** ${periodBreakdown.length} periods scheduled\n\n` +
          `You can ask me: *"Can I safely bunk Period 1 today?"*, *"Which classes can I skip today?"*, or *"Show my semester forecast"*.`;
      }

      return res.json({
        reply,
        provider: 'BunkBot AI'
      });
    }

  } catch (err) {
    console.error('BunkBot error:', err);
    res.status(500).json({ message: 'BunkBot error: ' + err.message });
  }
});

module.exports = router;
