const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// 1. MANIFEST - فقط غير الفيرسيون هنا
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "com.souhail.stremio",
        "version": "100.0.0",  // غير هنا فقط
        "name": "Souhail Stremio",
        "description": "Real-Debrid Torrent Streaming",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// 2. STREAM - نفس الكود اللي كان خدام
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    
    if (!RD_KEY) {
        return res.json({ streams: [] });
    }
    
    try {
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams) {
            return res.json({ streams: [] });
        }
        
        // معالجة كل stream
        const processedStreams = data.streams.map((stream) => {
            const originalTitle = stream.name || stream.title || '';
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            // استخراج المعلومات
            const info = extractInfo(originalTitle);
            
            // إنشاء العنوان المنظم
            const formattedTitle = formatTitle(info, isCached, originalTitle);
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        // ترتيب حسب: Cached أولاً، ثم الحجم، ثم الجودة
        const sortedStreams = processedStreams.sort((a, b) => {
            // تحليل العنوان لمعرفة إذا cached
            const aCached = a.title.includes('✅');
            const bCached = b.title.includes('✅');
            
            if (bCached && !aCached) return 1;
            if (aCached && !bCached) return -1;
            
            // ترتيب حسب الحجم (استخراج من العنوان)
            const aSize = extractSizeFromTitle(a.title);
            const bSize = extractSizeFromTitle(b.title);
            
            return bSize - aSize;
        });
        
        res.json({ streams: sortedStreams });
        
    } catch (error) {
        res.json({ streams: [] });
    }
});

// 3. استخراج المعلومات من العنوان
function extractInfo(title) {
    const info = {
        size: 'Unknown',
        quality: '1080p',
        seeders: 0,
        codec: 'H.264',
        audio: 'AC3',
        language: 'English',
        subs: 'EN',
        source: 'WEB-DL',
        site: 'Torrent',
        year: ''
    };
    
    if (!title) return info;
    
    // الحجم
    const sizeMatch = title.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    if (sizeMatch) info.size = sizeMatch[0];
    
    // الجودة
    if (title.match(/4K/i)) info.quality = '4K';
    else if (title.match(/1080p/i)) info.quality = '1080p';
    else if (title.match(/720p/i)) info.quality = '720p';
    
    // السيدرز
    const seedersMatch = title.match(/(\d+)\s*Seeds?/i);
    if (seedersMatch) info.seeders = parseInt(seedersMatch[1]);
    
    // الكودك
    if (title.match(/x265|HEVC/i)) info.codec = 'HEVC';
    
    // الصوت
    if (title.match(/DDP5\.1/i)) info.audio = 'DDP5.1';
    else if (title.match(/DTS-HD/i)) info.audio = 'DTS-HD';
    else if (title.match(/AC3/i)) info.audio = 'AC3';
    
    // اللغة
    if (title.match(/Arabic/i)) info.language = 'Arabic';
    else if (title.match(/French/i)) info.language = 'French';
    
    // الترجمة
    if (title.match(/AR-Subs/i)) info.subs = 'AR';
    else if (title.match(/FR-Subs/i)) info.subs = 'FR';
    
    // المصدر
    if (title.match(/BluRay/i)) info.source = 'BluRay';
    else if (title.match(/WEB-DL/i)) info.source = 'WEB-DL';
    
    // الموقع
    const siteMatch = title.match(/\[(.*?)\]/);
    if (siteMatch) info.site = siteMatch[1];
    
    // السنة
    const yearMatch = title.match(/(19|20)\d{2}/);
    if (yearMatch) info.year = yearMatch[0];
    
    return info;
}

// 4. تنسيق العنوان
function formatTitle(info, isCached, originalTitle) {
    // تنظيف اسم الفيلم
    let cleanName = originalTitle
        .replace(/\[.*?\]/g, '')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(\d+(\.\d+)?)\s*(GB|MB)/gi, '')
        .replace(/(\d+)\s*Seeds?/gi, '')
        .replace(/4K|1080p|720p|480p/gi, '')
        .trim()
        .substring(0, 50);
    
    const lines = [];
    
    // خط 1: اسم الفيلم + السنة
    lines.push(`💎🎬 ${cleanName}${info.year ? ` (${info.year})` : ''}`);
    
    // خط 2: الحجم + الجودة + السيدرز
    lines.push(`💎💾 ${info.size}  💎📺 ${info.quality}  💎🧑‍🔧 ${info.seeders || '?'}`);
    
    // خط 3: الكودك + الصوت
    lines.push(`💎🎞️ ${info.codec}  💎🎧 ${info.audio}`);
    
    // خط 4: اللغة + الترجمة
    lines.push(`💎🔊 ${info.language}  💎🌐 ${info.subs}`);
    
    // خط 5: المصدر + الموقع
    lines.push(`💎📦 ${info.source}  💎🌍 ${info.site}`);
    
    // خط 6: النوع
    lines.push(isCached ? '💎🧲 RD Cached' : '💎📡 Torrent');
    
    return lines.join('\n');
}

// 5. استخراج الحجم للمقارنة
function extractSizeFromTitle(title) {
    const sizeMatch = title.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    if (!sizeMatch) return 0;
    
    const num = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[3].toUpperCase();
    
    // تحويل كلشي لـMB للمقارنة
    return unit === 'GB' ? num * 1024 : num;
}

// 6. صفحات المساعدة
app.get('/install', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Install Souhail Stremio v100</title>
            <style>
                body { font-family: Arial; padding: 20px; text-align: center; }
                .btn { display: inline-block; background: #28a745; color: white; 
                       padding: 15px 30px; border-radius: 5px; text-decoration: none; 
                       margin: 20px 0; font-size: 18px; }
                .box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>🎬 Souhail Stremio v100.0.0</h1>
            <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json" class="btn">
                📲 Install Now
            </a>
            <div class="box">
                <p>Or copy to Stremio:</p>
                <code>https://${req.hostname}/manifest.json</code>
            </div>
            <p><a href="/test">Test Page</a></p>
        </body>
        </html>
    `);
});

app.get('/test', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Arial; padding: 20px;">
            <h1>Test v100.0.0</h1>
            <pre style="background: #f8f9fa; padding: 15px;">
💎🎬 Inception (2010)
💎💾 1.8 GB  💎📺 1080p  💎🧑‍🔧 1500
💎🎞️ H.264  💎🎧 DTS-HD
💎🔊 English  💎🌐 EN
💎📦 BluRay  💎🌍 YTS
💎🧲 RD Cached</pre>
            <p><a href="/stream/movie/tt1375666.json">Test Inception</a></p>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => {
    res.redirect('/install');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '100.0.0',
        service: 'Souhail Stremio',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`
    ========================================
    🎬 Souhail Stremio v100.0.0
    ========================================
    📍 Port: ${PORT}
    🔗 Install: http://localhost:${PORT}/install
    ========================================
    `);
});
