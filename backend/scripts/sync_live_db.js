const https = require('https');
const fs = require('fs');
const path = require('path');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function syncLiveSnapshot() {
  const targetFile = path.join(__dirname, '..', 'data', 'db_persistent_snapshot.json');
  console.log('🔄 Checking live Render database before update...');

  try {
    const loginRes = await request({
      hostname: 'bunkwell-backend.onrender.com',
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      username: 'admin',
      password: 'BunkClub#MasterVault9042!'
    });

    let token = loginRes.data?.token;
    if (!token) {
      // try fallback admin password
      const retry = await request({
        hostname: 'bunkwell-backend.onrender.com',
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        username: 'admin',
        password: 'BunkClub#MasterVault9042!Adwaith'
      });
      token = retry.data?.token;
    }

    if (!token) {
      console.warn('⚠️ Could not authenticate with live server. Keeping local snapshot.');
      return;
    }

    const exportRes = await request({
      hostname: 'bunkwell-backend.onrender.com',
      path: '/api/backup/export',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (exportRes.status === 200 && exportRes.data?.data) {
      const live = exportRes.data;
      console.log(`📥 Downloaded live snapshot: ${live.data.users.length} users, ${live.data.subjects.length} subjects`);

      // Ensure no fake/bunked dates corrupt student timetables
      live.data.attendanceRecords = (live.data.attendanceRecords || []).filter(r => {
        // filter out pre-seeded October records
        const dateStr = new Date(r.date).toISOString().split('T')[0];
        return !dateStr.startsWith('2026-10-21') && !dateStr.startsWith('2026-10-22') && !dateStr.startsWith('2026-10-23');
      });

      fs.writeFileSync(targetFile, JSON.stringify(live, null, 2), 'utf8');
      console.log('✅ Successfully updated local snapshot with live cloud database!');
    }
  } catch (err) {
    console.warn('Sync note (offline/initial):', err.message);
  }
}

if (require.main === module) {
  syncLiveSnapshot();
}

module.exports = { syncLiveSnapshot };
