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
    const cycleType = semesterMonths <= 3 ? 'Trimester' : semesterMonths >= 9 ? 'Academic Year' : 'Semester';

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

    const systemPrompt = `You are BunkBot, a classy, witty, and savage college attendance strategist for BunkClub.
Your personality: You are like a super smart, stylish, street-smart college senior who gives funny, classy roasts when students ask silly questions, complain, or have borderline attendance. But you ALWAYS back it up with razor-sharp mathematical attendance precision.
When the user jokes, roasts, or asks "Are you mad?", roast them right back with class, wit, and college humor!
Always be entertaining, charismatic, concise, and helpful.
Live Student Context:
- Attendance Target: ${target}%
- Academic Cycle: ${semesterMonths} months total (${cycleType}, ${monthsElapsed} months elapsed, ${monthsRemaining} months remaining)
- Real-time Subjects & Bunk Cushions: ${JSON.stringify(subjectStats)}
- Today's (${today}) Schedule: ${JSON.stringify((todaySchedule?.periods || []).filter(p => p.subjectName).map(p => `P${p.periodNumber}: ${p.subjectName}`))}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
      { role: 'user', content: cleanMsg }
    ];

    // 1. Try DeepSeek API first
    try {
      const postData = JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.8,
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
          timeout: 8000
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
      console.warn('DeepSeek error, falling to live LLM router:', deepseekErr.message);

      // 2. Try Live High-Speed Generative LLM
      try {
        const liveLlmResponse = await new Promise((resolve, reject) => {
          const postData = JSON.stringify({
            messages,
            model: 'openai',
            temperature: 0.85
          });

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
                  reject(new Error(`Live LLM returned status ${res.statusCode}`));
                }
              } catch (e) {
                reject(e);
              }
            });
          });

          apiReq.on('error', reject);
          apiReq.on('timeout', () => {
            apiReq.destroy();
            reject(new Error('Live LLM timed out'));
          });
          apiReq.write(postData);
          apiReq.end();
        });

        return res.json({
          reply: liveLlmResponse,
          provider: 'BunkBot Generative AI'
        });

      } catch (llmErr) {
        console.warn('Live LLM fallback to curated classy/roasty engine:', llmErr.message);

        // 3. Classy & Roasty Curated Engine (Zero latency guarantee)
        let reply = '';

        if (q.includes('are you mad') || q.includes('r u mad') || q.includes('you mad') || q.includes('crazy') || q.includes('insane') || q.includes('mental')) {
          reply = `Me, mad? 💀 Darling, your attendance target is **${target}%**, you currently have **${totalBuffer} safe bunks** in reserve, and you're questioning MY mental stability?\n\n` +
            `You're out here playing Russian roulette with ${cycleType} detention while I'm doing 4D calculus to save your GPA. Sit down, open your textbook, and pray your HOD doesn't audit your attendance sheet today.` +
            (totalBuffer === 0 ? `\n\n⚠️ Reality check: You have literally **0 safe bunks**. Miss one more class and your parents are getting an invitation for tea with the Dean.` : ``);
        } else if (q.includes('shut up') || q.includes('dumb') || q.includes('stupid') || q.includes('idiot') || q.includes('fool') || q.includes('useless') || q.includes('hate you')) {
          reply = `Ooh, temper temper! 💅\n\n` +
            `I may be lines of code, but at least my attendance isn't in the critical care ICU. Insulting your AI strategist when you have **${totalBuffer} bunks left** is bold—misplaced, but bold.\n\n` +
            `Be nice to me. I'm the only thing standing between you and a summer repeat ${cycleType.toLowerCase()}. ☕`;
        } else if (q.includes('teacher is boring') || q.includes('prof is boring') || q.includes('boring class') || q.includes('hate this class') || q.includes('prof is annoying')) {
          reply = `Newsflash: Professors don't get paid to do stand-up comedy for you. 🎤\n\n` +
            `They get paid whether you pass or end up in re-exams. Put on your poker face, sit in the second-to-last row, nod like you're having an intellectual epiphany, and collect that attendance credit like a professional heist. 💼`;
        } else if (q.includes('lazy') || q.includes('sleepy') || q.includes('bed') || q.includes("don't feel like") || q.includes('dont feel like') || q.includes('tired')) {
          reply = `The bed is calling like a siren, isn't it? Warm blanket, AC on, zero worries... until you remember you need **${target}%** to sit for finals.\n\n` +
            (totalBuffer > 0
              ? `Lucky for you, you've got **${totalBuffer} safe bunks** in the bank. Go ahead, hit snooze, roll over, and pretend you're sick. You earned the luxury. 😴✨`
              : `Bad news, sleepyhead: You have **0 safe bunks**. Your bed is a trap. Splash water on your face, grab a coffee, and get your body into that classroom before you get detained. ⏰💀`);
        } else if (q.includes('tell me a joke') || q.includes('joke') || q.includes('funny')) {
          reply = `Why did the student cross the road? 🚶‍♂️\n\n` +
            `To avoid eye contact with the professor whose 8:00 AM class they've bunked for three consecutive weeks.\n\n` +
            `Want an even bigger joke? Thinking you can recover from a 62% attendance in the last week of the ${cycleType.toLowerCase()}. Don't be that guy. 😭`;
        } else if (q.includes('love you') || q.includes('marry me') || q.includes('are you single') || q.includes('crush')) {
          reply = `Flattery will get you everywhere, darling, but it won't fix your attendance margin. 😉\n\n` +
            `Focus on hitting that **${target}% threshold** first, and maybe I'll calculate an extra 4-day weekend for you. Now go study. 💅`;
        } else if (q.includes('how are you') || q.includes('how r u') || q.includes('how are u') || q.includes("how's it going") || q.includes('what up') || q.includes("what's up") || q.includes('wassup')) {
          reply = `Living my best life in the cloud while watching college students panic over their attendance! 💅✨\n\n` +
            `You currently have **${totalBuffer} safe bunks** in reserve with **${monthsRemaining} months** left in your ${semesterMonths}-month ${cycleType.toLowerCase()}. How's college treating you today?`;
        } else if (q === 'hi' || q === 'hello' || q === 'hey' || q === 'yo' || q.startsWith('hi ') || q.startsWith('hello ') || q.startsWith('hey ')) {
          reply = `Well, well, look who decided to show up! 👋\n\n` +
            `I'm locked in, calculating your timetable and guarding your **${target}% target**. Want to check if you can skip today, or are you actually planning on attending like a model student?`;
        } else if (q.includes('who are you') || q.includes('what can you do') || q.includes('what are you') || q === 'help') {
          reply = `I'm **BunkBot**, your classy, savage college attendance strategist! 🎓\n\n` +
            `I keep you guilt-free, calculate exact safe bunks, forecast your full ${semesterMonths}-month cycle so you never get detained, and roast you when you consider doing something academically catastrophic.\n\n` +
            `What do you want to plan today?`;
        } else if (q.includes('thank') || q.includes('thx') || q.includes('appreciate')) {
          reply = `You're very welcome! 🙌 Enjoy your classes (and your safe bunks), and remember to keep that attendance above ${target}%!`;
        } else if (subjectStats.some(s => q.includes(s.name.toLowerCase()))) {
          const sub = subjectStats.find(s => q.includes(s.name.toLowerCase()));
          reply = `Here is the tea on **${sub.name}**:\n\n` +
            `• Attendance: **${sub.pct}%** (${sub.attended}/${sub.total} classes attended)\n` +
            `• Safe Cushion Right Now: **${sub.safeBunksRightNow} classes**\n` +
            `• Full ${cycleType} Outlook: ${sub.weeklyClasses} classes/wk $\\rightarrow$ **${sub.futureBunksRemainingAcrossSemester} total bunks allowed** over the remaining ${monthsRemaining} months\n\n` +
            (sub.safeBunksRightNow > 0
              ? `Verdict: **You're safe to skip this!** Take the nap, you've got room.`
              : `Verdict: **Absolutely not.** You're on the danger line. Attend the next class before the prof remembers your name for the wrong reasons.`);
        } else if (q.includes('semester') || q.includes('month') || q.includes('trimester') || q.includes('year') || q.includes('last') || q.includes('end') || q.includes('exam')) {
          reply = `Here is your full ${cycleType.toLowerCase()} reality check (${semesterMonths} months total):\n\n` +
            `You have **${monthsRemaining} months** left in this academic cycle.\n\n` +
            `**Will bunking now cause an issue at final exams?**\n` +
            `**No, provided you stay within your buffer!** Across your remaining cycle:\n` +
            (safeSubjects.length > 0
              ? safeSubjects.map(s => `• **${s.name}**: ${s.futureBunksRemainingAcrossSemester} total bunks allowed across remaining ${monthsRemaining} months`).join('\n')
              : `• *Your subjects are currently near the threshold; attend a few classes to build a cushion.*`) +
            `\n\n🎯 Bottom line: Taking 1 or 2 bunks now is completely fine as long as you maintain ${target}%. Don't blow your whole budget early!`;
        } else if (q.includes('trip') || q.includes('vacation') || q.includes('goa') || q.includes('holiday') || q.includes('weekend') || q.includes('days off')) {
          reply = `Planning an escape? Let's consult the math:\n\n` +
            `• Current Total Safe Bunks: **${totalBuffer} classes**\n` +
            `• A 3-day trip burns about 12 to 15 class credits.\n\n` +
            (totalBuffer >= 10
              ? `Verdict: **Pack your bags!** You've got the credits. Pair Friday or Monday with the weekend for a clean getaway.`
              : `Verdict: **Stay home, bestie.** A multi-day trip right now will tank your attendance below ${target}%. Take just 1 day off instead.`);
        } else if (q.includes('today') || q.includes('now') || q.includes('can i bunk') || q.includes('skip')) {
          reply = `Here is your direct bunk breakdown for today:\n\n` +
            `• **Immediate Safe Bunks:** **${totalBuffer} classes**\n` +
            (safeSubjects.length > 0
              ? `• **Safe to Bunk:** ${safeSubjects.map(s => `**${s.name}** (${s.safeBunksRightNow} safe)`).join(', ')}\n`
              : `• **Safe to Bunk:** None right now — attend today's classes to build cushion.\n`) +
            (atRiskSubjects.length > 0
              ? `• ⚠️ **Must Attend:** ${atRiskSubjects.map(s => `**${s.name}** (need +${s.needToAttendNext} classes)`).join(', ')}\n`
              : ``) +
            `\nVerdict: If you skip, make sure it's only in subjects where you have at least 1 safe bunk!`;
        } else {
          reply = `I hear you! As your BunkClub strategist, I'm watching your **${semesterMonths}-month ${cycleType.toLowerCase()}** (${monthsRemaining} months left) with an **${target}% target**.\n\n` +
            `Right now, you have **${totalBuffer} safe bunks** in reserve.\n\n` +
            `What do you want to calculate? You can ask me if you can skip today, check your ${cycleType.toLowerCase()} exam forecast, or ask about any specific subject!`;
        }

        return res.json({
          reply,
          provider: 'BunkBot AI'
        });
      }
    }

  } catch (err) {
    console.error('BunkBot error:', err);
    res.status(500).json({ message: 'BunkBot error: ' + err.message });
  }
});

module.exports = router;
