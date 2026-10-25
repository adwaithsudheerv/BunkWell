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

    const cleanMsg = message.trim();
    const q = cleanMsg.toLowerCase();

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

    const totalBuffer = subjectStats.reduce((acc, s) => acc + s.safeBunksRightNow, 0);
    const atRiskSubjects = subjectStats.filter(s => !s.isSafe);
    const safeSubjects = subjectStats.filter(s => s.isSafe && s.safeBunksRightNow > 0);

    const systemPrompt = `You are BunkBot, a friendly, ultra-smart college attendance and bunk strategist for the BunkClub app.
You talk like a real, conversational AI assistant (like ChatGPT) - warm, conversational, natural, and witty.
Do not talk like a generic template. If the user asks general questions like "how are you", answer conversationally.
You have real-time live access to the student's exact academic profile:
- Attendance Target: ${target}%
- Semester: ${semesterMonths} months total (${monthsElapsed} months elapsed, ${monthsRemaining} months remaining)
- Subjects Summary: ${JSON.stringify(subjectStats)}
- Today's (${today}) Schedule: ${JSON.stringify((todaySchedule?.periods || []).filter(p => p.subjectName).map(p => `P${p.periodNumber}: ${p.subjectName}`))}

Tone: Natural, empathetic, helpful college companion. Do not overuse markdown asterisks. Format key highlights cleanly.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
      { role: 'user', content: cleanMsg }
    ];

    // Attempt DeepSeek API Call
    try {
      const postData = JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 500
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
        provider: 'DeepSeek AI'
      });

    } catch (deepseekErr) {
      console.warn('DeepSeek API fallback activated:', deepseekErr.message);

      // Intelligent, natural conversational fallback engine
      let reply = '';

      // 1. Casual Greetings & "How are you"
      if (q.includes('how are you') || q.includes('how r u') || q.includes('how are u') || q.includes("how's it going") || q.includes('what up') || q.includes("what's up") || q.includes('wassup')) {
        reply = `I'm doing great, thanks for asking! 😊 Ready to help you stay ahead of your attendance and manage your bunks safely.\n\n` +
          `You currently have **${totalBuffer} safe bunks** available across your subjects with **${monthsRemaining} months** left in the semester. How's college going today?`;
      } else if (q === 'hi' || q === 'hello' || q === 'hey' || q === 'yo' || q.startsWith('hi ') || q.startsWith('hello ') || q.startsWith('hey ') || q.includes('good morning') || q.includes('good evening')) {
        reply = `Hey there! 👋 Good to see you.\n\n` +
          `I'm locked in and tracking your attendance. Target is set at **${target}%**. Want to check if you can take an off today or forecast your semester exams?`;
      } else if (q.includes('who are you') || q.includes('what can you do') || q.includes('what are you') || q === 'help') {
        reply = `I'm **BunkBot**, your personal college attendance and bunk strategist! 🎓\n\n` +
          `Here is what I do for you:\n` +
          `• Tell you exactly which classes are safe to bunk right now\n` +
          `• Calculate full day off scenarios (like taking a long weekend on Friday or Monday)\n` +
          `• Forecast your entire ${semesterMonths}-month semester so you know if bunking now will cause issues at exam time\n` +
          `• Keep you strictly above your ${target}% target\n\n` +
          `What would you like to check?`;
      } else if (q.includes('thank') || q.includes('thx') || q.includes('appreciate')) {
        reply = `You're very welcome! 🙌 Enjoy your classes (and your safe bunks), and remember to keep that attendance above ${target}%!`;
      } else if (q.includes('bye') || q.includes('see you') || q.includes('good night')) {
        reply = `Catch you later! Have a great time, and I'll keep an eye on your schedule. 🚀`;
      }
      // 2. Specific Subject Match
      else if (subjectStats.some(s => q.includes(s.name.toLowerCase()))) {
        const sub = subjectStats.find(s => q.includes(s.name.toLowerCase()));
        reply = `Here is the status for **${sub.name}**:\n\n` +
          `• Current Attendance: **${sub.pct}%** (${sub.attended}/${sub.total} classes attended)\n` +
          `• Safe Bunk Cushion: **${sub.safeBunksRightNow} classes** right now\n` +
          `• Semester Outlook: ${sub.weeklyClasses} classes/week $\\rightarrow$ **${sub.futureBunksRemainingAcrossSemester} total bunks allowed** over the remaining ${monthsRemaining} months\n\n` +
          (sub.safeBunksRightNow > 0
            ? `Verdict: **You can safely skip this class!** It will not push you below ${target}%.`
            : `Verdict: **Do not bunk!** You are below or right on the threshold and need to attend.`);
      }
      // 3. Semester / Month / End of Semester Questions
      else if (q.includes('semester') || q.includes('month') || q.includes('last') || q.includes('end') || q.includes('later') || q.includes('exam')) {
        reply = `Here is your full-semester forecast:\n\n` +
          `You have **${monthsRemaining} months** left in your ${semesterMonths}-month semester.\n\n` +
          `**Will bunking now cause an issue at final exams?**\n` +
          `**No, as long as you stay within your cushion!** Across your remaining semester, you have:\n` +
          (safeSubjects.length > 0
            ? safeSubjects.map(s => `• **${s.name}**: ${s.futureBunksRemainingAcrossSemester} total bunks allowed across remaining ${monthsRemaining} months`).join('\n')
            : `• *Your subjects are currently near the threshold; attend a few consecutive classes to build a cushion.*`) +
          `\n\n🎯 Bottom line: Taking 1 or 2 bunks now is safe if you stay above ${target}%.`;
      }
      // 4. Trip / Vacation / Weekend
      else if (q.includes('trip') || q.includes('vacation') || q.includes('goa') || q.includes('holiday') || q.includes('weekend') || q.includes('days off')) {
        reply = `Thinking of taking a trip? Let's check the numbers:\n\n` +
          `• You currently have **${totalBuffer} safe class bunks** available.\n` +
          `• A 3-day trip usually costs around 12 to 15 class credits.\n\n` +
          (totalBuffer >= 10
            ? `Verdict: **You have a solid buffer!** The smartest way is pairing Friday or Monday with the weekend for a safe mini-trip.`
            : `Verdict: **A long trip right now is risky.** You'll likely drop below ${target}%. Instead, try taking just 1 day off (like Friday) to stay safe.`);
      }
      // 5. Today / Bunking Now
      else if (q.includes('today') || q.includes('now') || q.includes('can i bunk') || q.includes('skip')) {
        reply = `Here is your direct bunk analysis for your **${target}% target**:\n\n` +
          `• **Immediate Bunk Cushion:** You have **${totalBuffer} safe bunks** right now.\n` +
          (safeSubjects.length > 0
            ? `• **Safe to Bunk:** ${safeSubjects.map(s => `**${s.name}** (${s.safeBunksRightNow} safe)`).join(', ')}\n`
            : `• **Safe to Bunk:** None right now — attend today's classes to build cushion.\n`) +
          (atRiskSubjects.length > 0
            ? `• ⚠️ **Must Attend:** ${atRiskSubjects.map(s => `**${s.name}** (need +${s.needToAttendNext} classes)`).join(', ')}\n`
            : ``) +
          `\nVerdict: If you skip today, make sure to only miss subjects where you have at least 1 safe bunk!`;
      }
      // 6. Natural Default Conversational Response
      else {
        reply = `I hear you! As your BunkClub strategist, I'm tracking your **${semesterMonths}-month semester** (${monthsRemaining} months left) with an **${target}% target**.\n\n` +
          `Right now, you have **${totalBuffer} safe bunks** in reserve.\n\n` +
          `You can ask me things like:\n` +
          `• "Can I skip class today?"\n` +
          `• "Will bunking now hurt my semester exams in Month ${semesterMonths}?"\n` +
          `• "Can I take a 3-day weekend trip?"\n` +
          `• Or ask about any specific subject!`;
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
