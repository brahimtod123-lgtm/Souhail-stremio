const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// MANIFEST
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "com.souhail.streamer.complete",
        "version": "2.0.0",
        "name": "Souhail Complete",
        "description": "Real-Debrid Torrent Streaming with Full Info",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// STREAM مع كل المعلومات
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
        
        const processedStreams = data.streams.map((stream) => {
            const originalTitle = stream.name || stream.title || 'Unknown';
            const info = extractCompleteInfo(originalTitle);
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            return {
                title: createCompleteTitle(originalTitle, info, isCached),
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch (error) {
        res.json({ streams: [] });
    }
});

// استخراج كامل للمعلومات
function extractCompleteInfo(fullTitle) {
    const info = {
        // اسم الفيلم الأساسي
        movieName: '',
        
        // المعلومات التقنية
        size: 'Unknown',
        sizeInBytes: 0,
        quality: '1080p',
        seeders: 0,
        codec: 'H.264',
        audio: 'AC3',
        language: 'English',
        subs: 'EN',
        
        // معلومات إضافية
        year: '',
        source: 'WEB-DL',
        group: '',
        site: 'Unknown'
    };
    
    if (!fullTitle) return info;
    
    // 1. استخراج اسم الموقع (أولاً)
    const sitePatterns = [
        { pattern: /\[(.*?)\]/g, extract: 'brackets' },
        { pattern: /\((.*?)\)/g, extract: 'parentheses' },
        { pattern: /\b(YTS|RARBG|ETRG|UTR|Tigole|QxR|Vyndros|FraMeSToR|PSA|CRiSC)\b/i, extract: 'name' }
    ];
    
    for (const sitePattern of sitePatterns) {
        const matches = fullTitle.match(sitePattern.pattern);
        if (matches && matches.length > 0) {
            if (sitePattern.extract === 'brackets') {
                info.site = matches[0].replace(/[\[\]]/g, '');
            } else if (sitePattern.extract === 'parentheses') {
                info.site = matches[0].replace(/[\(\)]/g, '');
            } else {
                info.site = matches[0];
            }
            break;
        }
    }
    
    // 2. استخراج الحجم
    const sizeMatch = fullTitle.match(/(\d+(\.\d+)?)\s*(GB|MB|GiB|MiB)/i);
    if (sizeMatch) {
        const num = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[3].toUpperCase();
        const isGB = unit.includes('GB') || unit.includes('GIB');
        info.size = `${num} ${isGB ? 'GB' : 'MB'}`;
        info.sizeInBytes = isGB ? num * 1073741824 : num * 1048576;
    }
    
    // 3. استخراج الجودة
    if (fullTitle.match(/4K|UHD|2160p/i)) {
        info.quality = '4K';
    } else if (fullTitle.match(/1080p|FHD/i)) {
        info.quality = '1080p';
    } else if (fullTitle.match(/720p|HD/i)) {
        info.quality = '720p';
    } else if (fullTitle.match(/480p|SD/i)) {
        info.quality = '480p';
    }
    
    // 4. استخراج السيدرز
    const seedersMatch = fullTitle.match(/(\d+)\s*Seeds?/i) || 
                        fullTitle.match(/Seeds?:?\s*(\d+)/i) ||
                        fullTitle.match(/S:\s*(\d+)/i);
    if (seedersMatch) {
        info.seeders = parseInt(seedersMatch[1]);
    }
    
    // 5. استخراج الكودك
    if (fullTitle.match(/x265|HEVC/i)) info.codec = 'HEVC';
    else if (fullTitle.match(/AV1/i)) info.codec = 'AV1';
    else if (fullTitle.match(/VP9/i)) info.codec = 'VP9';
    else if (fullTitle.match(/x264/i)) info.codec = 'H.264';
    
    // 6. استخراج الصوت
    if (fullTitle.match(/DDP5\.1|Dolby Digital Plus/i)) info.audio = 'DDP5.1';
    else if (fullTitle.match(/DTS-HD|DTS-HD MA/i)) info.audio = 'DTS-HD MA';
    else if (fullTitle.match(/TrueHD/i)) info.audio = 'TrueHD';
    else if (fullTitle.match(/AC3|Dolby Digital/i)) info.audio = 'AC3';
    else if (fullTitle.match(/AAC/i)) info.audio = 'AAC';
    
    // 7. استخراج اللغة
    if (fullTitle.match(/Arabic|AR|Arabe/i)) info.language = 'Arabic';
    else if (fullTitle.match(/French|FR|Français/i)) info.language = 'French';
    else if (fullTitle.match(/Spanish|ES|Español/i)) info.language = 'Spanish';
    else if (fullTitle.match(/Multi/i)) info.language = 'Multi';
    
    // 8. استخراج الترجمة
    if (fullTitle.match(/Arabic Subs|AR-Subs/i)) info.subs = 'AR';
    else if (fullTitle.match(/French Subs|FR-Subs/i)) info.subs = 'FR';
    else if (fullTitle.match(/English Subs|EN-Subs/i)) info.subs = 'EN';
    else if (fullTitle.match(/Spanish Subs|ES-Subs/i)) info.subs = 'ES';
    else if (fullTitle.match(/Multi Subs/i)) info.subs = 'Multi';
    
    // 9. استخراج السنة
    const yearMatch = fullTitle.match(/(19|20)\d{2}/);
    if (yearMatch) info.year = yearMatch[0];
    
    // 10. استخراج المصدر
    if (fullTitle.match(/BluRay|Blu-Ray|BD/i)) info.source = 'BluRay';
    else if (fullTitle.match(/WEB-DL|WEB/i)) info.source = 'WEB-DL';
    else if (fullTitle.match(/WEBRip/i)) info.source = 'WEBRip';
    else if (fullTitle.match(/HDTV/i)) info.source = 'HDTV';
    else if (fullTitle.match(/DVD/i)) info.source = 'DVD';
    
    // 11. استخراج المجموعة
    const groupMatch = fullTitle.match(/-\s*(.*?)\s*\[/i) || 
                      fullTitle.match(/-\s*(.*?)\s*$/i);
    if (groupMatch && groupMatch[1]) {
        info.group = groupMatch[1].trim();
    }
    
    // 12. استخراج اسم الفيلم (بعد إزالة كل المعلومات الفنية)
    info.movieName = extractMovieName(fullTitle);
    
    return info;
}

// استخراج اسم الفيلم النظيف
function extractMovieName(fullTitle) {
    let cleanTitle = fullTitle;
    
    // إزالة المعلومات التقنية
    cleanTitle = cleanTitle.replace(/\[.*?\]/g, '');
    cleanTitle = cleanTitle.replace(/\./g, ' ');
    cleanTitle = cleanTitle.replace(/\s+/g, ' ');
    
    // إزالة الجودة
    cleanTitle = cleanTitle.replace(/(4K|2160p|1080p|720p|480p)/gi, '');
    
    // إزالة الحجم
    cleanTitle = cleanTitle.replace(/(\d+(\.\d+)?)\s*(GB|MB)/gi, '');
    
    // إزالة السيدرز
    cleanTitle = cleanTitle.replace(/(\d+)\s*Seeds?/gi, '');
    
    // إزالة الكودك
    cleanTitle = cleanTitle.replace(/x265|x264|HEVC|AV1|VP9/gi, '');
    
    // إزالة الصوت
    cleanTitle = cleanTitle.replace(/DDP5\.1|DTS-HD|TrueHD|AC3|AAC/gi, '');
    
    // إزالة المصدر
    cleanTitle = cleanTitle.replace(/BluRay|WEB-DL|WEBRip|HDTV|DVD/gi, '');
    
    // تنظيف نهائي
    cleanTitle = cleanTitle
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .substring(0, 60);
    
    return cleanTitle || 'Movie';
}

// إنشاء العنوان الكامل
function createCompleteTitle(originalTitle, info, isCached) {
    const lines = [];
    
    // سطر 1: اسم الفيلم + السنة
    const titleLine = info.movieName + (info.year ? ` (${info.year})` : '');
    lines.push(`💎🎬 ${titleLine || 'Movie'}`);
    
    // سطر 2: الحجم + الجودة + السيدرز
    lines.push(`💎💾 ${info.size}  |  💎📺 ${info.quality}  |  💎🧑‍🔧 ${info.seeders || '?'}`);
    
    // سطر 3: الكودك + الصوت
    lines.push(`💎🎞️ ${info.codec}  |  💎🎧 ${info.audio}`);
    
    // سطر 4: اللغة + الترجمة
    lines.push(`💎🔊 ${info.language}  |  💎🌐 ${info.subs}`);
    
    // سطر 5: المصدر + الموقع
    lines.push(`💎📦 ${info.source}  |  💎🌍 ${info.site || 'Torrent Site'}`);
    
    // سطر 6: النوع
    lines.push(isCached ? '💎🧲 RD Cached' : '💎📡 Torrent');
    
    return lines.join('\n');
}

// صفحة Install
app.get('/install', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
            <h1>📲 Install Souhail Complete</h1>
            <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json" 
               style="display: inline-block; background: #28a745; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; margin: 20px 0;">
                Install Now
            </a>
            <p>Or copy to Stremio:</p>
            <code style="background: #f4f4f4; padding: 10px; display: block;">https://${req.hostname}/manifest.json</code>
            <p><a href="/">← Home</a> | <a href="/test">Test</a></p>
        </body>
        </html>
    `);
});

// صفحة Test
app.get('/test', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Arial; padding: 20px;">
            <h1>🧪 Test Page</h1>
            <h3>Example Output:</h3>
            <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
💎🎬 Inception (2010)
💎💾 1.8 GB  |  💎📺 1080p  |  💎🧑‍🔧 1500
💎🎞️ H.264  |  💎🎧 DTS-HD
💎🔊 English  |  💎🌐 EN
💎📦 BluRay  |  💎🌍 YTS
💎🧲 RD Cached</pre>
            
            <h3>Test Links:</h3>
            <ul>
                <li><a href="/stream/movie/tt1375666.json">Inception</a></li>
                <li><a href="/stream/movie/tt0816692.json">Interstellar</a></li>
                <li><a href="/stream/movie/tt0468569.json">The Dark Knight</a></li>
                <li><a href="/stream/series/tt0944947.json">Game of Thrones</a></li>
            </ul>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
            <h1>🎬 Souhail Complete Addon</h1>
            <p><a href="/install" style="font-size: 18px;">📲 Install Addon</a></p>
            <p>Real-Debrid: ${RD_KEY ? '✅ Configured' : '❌ Not Configured'}</p>
            <p>Displays: Movie Name, Size, Quality, Seeders, Codec, Audio, Language, Subtitles, Source, Site</p>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});
