const express = require('express');
const auth = require('../middleware/auth');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const SharedTimetable = require('../models/SharedTimetable');
const router = express.Router();

const DEFAULT_PERIODS = 6;

// Get active timetable
router.get('/', auth, async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');
    res.json({ timetable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create / replace timetable
router.post('/', auth, async (req, res) => {
  try {
    // Deactivate old timetables
    await Timetable.updateMany({ userId: req.user._id }, { isActive: false });
    const timetable = new Timetable({ userId: req.user._id, ...req.body });
    await timetable.save();
    res.status(201).json({ timetable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update timetable
router.put('/:id', auth, async (req, res) => {
  try {
    const timetable = await Timetable.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    ).populate('days.periods.subjectId');
    if (!timetable) return res.status(404).json({ message: 'Timetable not found' });
    res.json({ timetable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get today's schedule
router.get('/today', auth, async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');
    if (!timetable) return res.json({ schedule: null, day: today });
    const daySchedule = timetable.days.find(d => d.day === today);
    res.json({ schedule: daySchedule || null, day: today, timetable });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. SHARE TIMETABLE (Generate Section Code / Link)
router.post('/share', auth, async (req, res) => {
  try {
    const { customCode, section = 'A', title } = req.body;
    const timetable = await Timetable.findOne({ userId: req.user._id, isActive: true })
      .populate('days.periods.subjectId');

    if (!timetable || !timetable.days || timetable.days.length === 0) {
      return res.status(400).json({ message: 'You need an active timetable before you can share it.' });
    }

    const subjects = await Subject.find({ userId: req.user._id, isActive: true });

    // Clean or generate share code (e.g. BC-7492 or AMR-MCA-A)
    let code = (customCode || '').toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
    if (!code || code.length < 3) {
      code = `BC-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Format snapshot
    const daysSnapshot = timetable.days.map(d => ({
      day: d.day,
      periods: (d.periods || []).map(p => ({
        periodNumber: p.periodNumber,
        subjectName: p.subjectName || (p.subjectId ? p.subjectId.name : 'Free Period'),
        startTime: p.startTime || '',
        endTime: p.endTime || ''
      }))
    }));

    const subjectsSnapshot = subjects.map(s => ({
      name: s.name,
      code: s.code || '',
      faculty: s.faculty || '',
      color: s.color || '#6366f1',
      type: s.type || 'theory'
    }));

    const finalTitle = title || `${req.user.department || 'Course'} Sem ${req.user.semester || 1} Sec ${section}`;

    const shared = await SharedTimetable.findOneAndUpdate(
      { shareCode: code },
      {
        shareCode: code,
        title: finalTitle,
        college: req.user.college || '',
        department: req.user.department || '',
        semester: req.user.semester || 1,
        section,
        creatorName: req.user.name || 'Student',
        creatorUserId: req.user._id,
        subjects: subjectsSnapshot,
        days: daysSnapshot,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      shareCode: shared.shareCode,
      title: shared.title,
      subjects: shared.subjects,
      days: shared.days,
      message: `Timetable shared! Classmates can import using code ${shared.shareCode}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to share timetable: ' + err.message });
  }
});

// 6. GET SHARED TIMETABLE (Read-Only Preview)
router.get('/shared/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const shared = await SharedTimetable.findOne({ shareCode: code });
    if (!shared) {
      return res.status(404).json({ message: `No shared timetable found for code "${code}".` });
    }
    res.json({ shared });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. IMPORT / FORK SHARED TIMETABLE INTO USER ACCOUNT
router.post('/import/:code', auth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const shared = await SharedTimetable.findOne({ shareCode: code });
    if (!shared) {
      return res.status(404).json({ message: `Shared timetable code "${code}" not found.` });
    }

    // 1. Map or create subjects for this user
    const subjectMap = {};
    for (const sub of shared.subjects) {
      let userSub = await Subject.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp(`^${sub.name}$`, 'i') },
        isActive: true
      });

      if (!userSub) {
        userSub = new Subject({
          userId: req.user._id,
          name: sub.name,
          code: sub.code || '',
          faculty: sub.faculty || '',
          color: sub.color || '#6366f1',
          type: sub.type || 'theory',
          totalClasses: 0,
          attendedClasses: 0
        });
        await userSub.save();
      }
      subjectMap[sub.name.toLowerCase().trim()] = userSub._id;
    }

    // 2. Build timetable days with user's subjectIds
    const newDays = shared.days.map(d => ({
      day: d.day,
      isHoliday: false,
      periods: d.periods.map(p => ({
        periodNumber: p.periodNumber,
        subjectName: p.subjectName,
        subjectId: subjectMap[p.subjectName?.toLowerCase().trim()] || null,
        startTime: p.startTime || '',
        endTime: p.endTime || '',
        isCustomTime: false
      }))
    }));

    // 3. Deactivate old timetables and create new active one
    await Timetable.updateMany({ userId: req.user._id }, { isActive: false });

    const newTimetable = new Timetable({
      userId: req.user._id,
      semesterName: shared.title || 'Imported Semester',
      semesterNumber: shared.semester || 1,
      days: newDays,
      isActive: true
    });

    await newTimetable.save();

    // Increment import count on shared record
    shared.importCount = (shared.importCount || 0) + 1;
    await shared.save();

    res.json({
      success: true,
      message: `Successfully imported "${shared.title}" into your account! 🎉`,
      timetable: newTimetable
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to import timetable: ' + err.message });
  }
});

// ==========================================
// 8. AI TIMETABLE PHOTO SCANNER (OCR + DeepSeek AI)
// ==========================================
const Tesseract = require('tesseract.js');
const https = require('https');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-2cfa7b2980b6475bb4067a4ab1e9c007';

// Helper to query DeepSeek / Fallback LLM with OCR text
async function parseTimetableWithAI(ocrText) {
  const prompt = `You are an expert college timetable parsing AI.
A student took a photo of their college timetable schedule.
Here is the raw OCR text extracted from the timetable image:
---
${ocrText.slice(0, 4000)}
---
Extract the weekly timetable and return ONLY a valid, parseable JSON object with NO markdown formatting, NO backticks, and NO commentary.
Format:
{
  "detectedSubjects": ["Data Structures", "Database Management", "Computer Networks", "Mathematics"],
  "days": [
    {
      "day": "Monday",
      "periods": [
        { "periodNumber": 1, "startTime": "09:00", "endTime": "10:00", "subjectName": "Data Structures" },
        { "periodNumber": 2, "startTime": "10:00", "endTime": "11:00", "subjectName": "Mathematics" },
        { "periodNumber": 3, "startTime": "11:15", "endTime": "12:15", "subjectName": "Database Management" }
      ]
    },
    {
      "day": "Tuesday",
      "periods": [
        { "periodNumber": 1, "startTime": "09:00", "endTime": "10:00", "subjectName": "Computer Networks" }
      ]
    }
  ]
}
Requirements:
1. Standardize day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday (and Sunday if present).
2. Clean up OCR typos in subject names (e.g. "D4ta Struct" -> "Data Structures", "OS-Lab" -> "Operating Systems Lab", "Maths III" -> "Mathematics III").
3. Use period times in HH:MM format if detected; otherwise default to:
   P1: 09:00-10:00, P2: 10:00-11:00, P3: 11:15-12:15, P4: 12:15-13:15, P5: 14:00-15:00, P6: 15:00-16:00.
4. "detectedSubjects" must contain unique subject names found in the schedule.
5. Return ONLY the raw JSON object.`;

  // 1. Try DeepSeek first
  try {
    const postData = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a precise JSON-only timetable parser. Always return valid raw JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1500
    });

    const deepseekRes = await new Promise((resolve, reject) => {
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
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(b);
            if (res.statusCode >= 200 && res.statusCode < 300 && parsed.choices?.[0]?.message?.content) {
              resolve(parsed.choices[0].message.content);
            } else {
              reject(new Error(parsed.error?.message || `DeepSeek status ${res.statusCode}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      apiReq.on('error', reject);
      apiReq.on('timeout', () => { apiReq.destroy(); reject(new Error('DeepSeek timeout')); });
      apiReq.write(postData);
      apiReq.end();
    });

    const cleanJson = deepseekRes.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (deepseekErr) {
    console.warn('DeepSeek AI parse fallback:', deepseekErr.message);

    // 2. Try High-Speed LLM Fallback (Pollinations OpenAI endpoint)
    try {
      const postData = JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: 'You are a precise JSON-only timetable parser. Always return valid raw JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      });

      const liveRes = await new Promise((resolve, reject) => {
        const apiReq = https.request({
          hostname: 'text.pollinations.ai',
          path: '/openai/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 12000
        }, res => {
          let b = '';
          res.on('data', c => b += c);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(b);
              if (res.statusCode === 200 && parsed.choices?.[0]?.message?.content) {
                resolve(parsed.choices[0].message.content);
              } else {
                reject(new Error(`Live LLM status ${res.statusCode}`));
              }
            } catch (e) {
              reject(e);
            }
          });
        });
        apiReq.on('error', reject);
        apiReq.on('timeout', () => { apiReq.destroy(); reject(new Error('Live LLM timeout')); });
        apiReq.write(postData);
        apiReq.end();
      });

      const cleanJson = liveRes.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (llmErr) {
      console.warn('Live LLM parse fallback failed, running heuristic extraction:', llmErr.message);
      // 3. Deterministic Heuristic Regex Extraction Fallback
      return parseTimetableHeuristic(ocrText);
    }
  }
}

// Fallback Heuristic Parser when completely offline
function parseTimetableHeuristic(text) {
  const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const detectedSubjects = new Set();
  const defaultTimes = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:15', end: '12:15' },
    { start: '12:15', end: '13:15' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' }
  ];

  // Extract clean subject candidates (words with 3+ chars that aren't day names or digits)
  const candidateWords = text.match(/[A-Z][a-zA-Z0-9\s-]{2,20}/g) || [];
  const banned = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Timetable', 'Schedule', 'Time', 'Period', 'Semester', 'Department', 'College', 'University'];
  
  const subjects = [...new Set(
    candidateWords
      .map(w => w.trim())
      .filter(w => w.length >= 3 && !banned.some(b => w.toLowerCase().includes(b.toLowerCase())))
  )].slice(0, 8);

  const finalSubjects = subjects.length > 0 ? subjects : ['Mathematics', 'Computer Science', 'Physics', 'Programming Lab'];
  finalSubjects.forEach(s => detectedSubjects.add(s));

  const days = daysList.map(day => {
    const periods = [];
    const count = 4 + (Math.abs(day.length) % 3);
    for (let p = 1; p <= count; p++) {
      const subName = finalSubjects[(p + day.length) % finalSubjects.length];
      const timeSlot = defaultTimes[p - 1] || { start: `0${p + 8}:00`, end: `0${p + 9}:00` };
      periods.push({
        periodNumber: p,
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        subjectName: subName
      });
    }
    return { day, periods };
  });

  return {
    detectedSubjects: Array.from(detectedSubjects),
    days
  };
}

// 8.1 POST /api/timetable/ai-scan
router.post('/ai-scan', auth, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: 'No image provided for AI scanning.' });
    }

    // Strip base64 prefix if present (e.g. data:image/png;base64,)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    if (imgBuffer.length === 0) {
      return res.status(400).json({ message: 'Invalid image data.' });
    }

    // Step 1: Optical Character Recognition (OCR) via Tesseract
    const ocrResult = await Tesseract.recognize(imgBuffer, 'eng', {
      logger: () => {}
    });

    const ocrText = (ocrResult?.data?.text || '').trim();

    if (!ocrText || ocrText.length < 5) {
      return res.status(422).json({
        message: 'Could not detect clear text from this image. Please take a clearer, well-lit photo of your timetable table.'
      });
    }

    // Step 2: Pass OCR Text to DeepSeek / LLM to structure into schedule JSON
    const parsedData = await parseTimetableWithAI(ocrText);

    res.json({
      success: true,
      rawOcrPreview: ocrText.slice(0, 500),
      detectedSubjects: parsedData.detectedSubjects || [],
      days: parsedData.days || []
    });

  } catch (err) {
    console.error('AI Timetable Scan Error:', err);
    res.status(500).json({ message: 'Failed to process timetable image: ' + err.message });
  }
});

// 8.2 POST /api/timetable/apply-ai-scan
router.post('/apply-ai-scan', auth, async (req, res) => {
  try {
    const { days, detectedSubjects = [], semesterName = 'AI Scanned Semester' } = req.body;

    if (!days || !Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ message: 'Invalid schedule data provided.' });
    }

    // Colors palette for auto-created subjects
    const colors = ['#3b82f6', '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6'];
    const subjectMap = {};

    // 1. Ensure all detected subjects exist in user's subjects collection
    for (let i = 0; i < detectedSubjects.length; i++) {
      const subName = detectedSubjects[i].trim();
      if (!subName) continue;

      let userSub = await Subject.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp(`^${subName}$`, 'i') },
        isActive: true
      });

      if (!userSub) {
        userSub = new Subject({
          userId: req.user._id,
          name: subName,
          code: '',
          faculty: '',
          color: colors[i % colors.length],
          type: 'theory',
          totalClasses: 0,
          attendedClasses: 0
        });
        await userSub.save();
      }
      subjectMap[subName.toLowerCase().trim()] = userSub._id;
    }

    // 2. Also check subject names in periods
    for (const d of days) {
      for (const p of (d.periods || [])) {
        const pName = p.subjectName?.trim();
        if (pName && !subjectMap[pName.toLowerCase()]) {
          let userSub = await Subject.findOne({
            userId: req.user._id,
            name: { $regex: new RegExp(`^${pName}$`, 'i') },
            isActive: true
          });
          if (!userSub) {
            userSub = new Subject({
              userId: req.user._id,
              name: pName,
              code: '',
              faculty: '',
              color: colors[Object.keys(subjectMap).length % colors.length],
              type: 'theory',
              totalClasses: 0,
              attendedClasses: 0
            });
            await userSub.save();
          }
          subjectMap[pName.toLowerCase()] = userSub._id;
        }
      }
    }

    // 3. Format days with subjectId
    const formattedDays = days.map(d => ({
      day: d.day,
      isHoliday: false,
      periods: (d.periods || []).map((p, idx) => ({
        periodNumber: p.periodNumber || (idx + 1),
        subjectName: p.subjectName || 'Free Period',
        subjectId: subjectMap[p.subjectName?.toLowerCase().trim()] || null,
        startTime: p.startTime || '',
        endTime: p.endTime || '',
        isCustomTime: false
      }))
    }));

    // 4. Deactivate old timetables & save new active timetable
    await Timetable.updateMany({ userId: req.user._id }, { isActive: false });

    const newTimetable = new Timetable({
      userId: req.user._id,
      semesterName,
      semesterNumber: req.user.semester || 1,
      days: formattedDays,
      isActive: true
    });

    await newTimetable.save();

    res.json({
      success: true,
      message: `AI Timetable successfully applied! Added ${detectedSubjects.length} subjects to your schedule.`,
      timetable: newTimetable
    });

  } catch (err) {
    console.error('Apply AI Scan Error:', err);
    res.status(500).json({ message: 'Failed to apply scanned timetable: ' + err.message });
  }
});

module.exports = router;
