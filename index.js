const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

// 1. MANIFEST
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "com.souhail.stremio",
        "version": "1.0.0",
        "name": "Souhail Streamer",
        "description": "Real-Debrid Torrent Streaming",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// 2. STREAM مع التنسيق الجديد
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    
    if (!RD_KEY || RD_KEY === 'your_api_key_here') {
        return res.json({ 
            streams: [],
            error: "Real-Debrid API key not configured"
        });
    }
    
    try {
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        // جلب اسم الفيلم من OMDB
        let movieTitle = await getMovieTitle(id);
        
        const processedStreams = data.streams.map(stream => {
            const info = extractInfoFromTitle(stream.name || stream.title);
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            return {
                title: formatCustomTitle(movieTitle, info, isCached),
                name: stream.name || stream.title,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {},
                // للترتيب
                _size: info.sizeInBytes || 0,
                _quality: info.qualityValue || 0,
                _seeders: info.seeders || 0,
                _isCached: isCached
            };
        });
        
        // الترتيب: Cached أولاً → الحجم → الجودة → Seeders
        const sortedStreams = processedStreams.sort((a, b) => {
            // 1. Cached أولاً
            if (b._isCached !== a._isCached) {
                return b._isCached ? 1 : -1;
            }
            
            // 2. من الأكبر حجماً
            if (b._size !== a._size) {
                return b._size - a._size;
            }
            
            // 3. أعلى جودة
            if (b._quality !== a._quality) {
                return b._quality - a._quality;
            }
            
            // 4. أعلى seeders
            return b._seeders - a._seeders;
        });
        
        const finalStreams = sortedStreams.map(stream => ({
            title: stream.title,
            url: stream.url,
            behaviorHints: stream.behaviorHints
        }));
        
        res.json({ streams: finalStreams });
        
    } catch (error) {
        console.error('Error:', error);
        res.json({ streams: [] });
    }
});

// 3. دالة التنسيق حسب طلبك
function formatCustomTitle(movieTitle, info, isCached) {
    const lines = [];
    
    // السطر الأول: اسم الفيلم
    if (movieTitle) {
        lines.push(`💎🎬 ${movieTitle}`);
    }
    
    // السطر الثاني: المعلومات الأساسية
    const mainInfo = [
        info.size ? `💎💾 ${info.size}` : '💎💾 Unknown',
        `💎📺 ${info.quality}`,
        info.seeders > 0 ? `💎🧑‍🔧 ${info.seeders}` : '💎🧑‍🔧 ?',
        `💎🎞️ ${info.codec}`,
        `💎🎧 ${info.audio}`,
        `💎🔊 ${info.language}`,
        `💎🌐 ${info.subs}`
    ].join('  ');
    lines.push(mainInfo);
    
    // السطر الثالث: النوع
    lines.push(isCached ? '💎🧲 RD Cached' : '💎📡 Torrent');
    
    return lines.join('\n');
}

// 4. استخراج المعلومات
function extractInfoFromTitle(title) {
    const info = {
        quality: '1080p',
        qualityValue: 3, // 1080p = 3
        codec: 'H.264',
        audio: 'AC3',
        language: 'English',
        subs: 'EN',
        size: 'Unknown',
        sizeInBytes: 0,
        seeders: 0
    };
    
    if (!title) return info;
    
    // الجودة
    if (title.match(/4K/i)) {
        info.quality = '4K';
        info.qualityValue = 5;
    } else if (title.match(/2160p/i)) {
        info.quality = '2160p';
        info.qualityValue = 4;
    } else if (title.match(/1080p/i)) {
        info.quality = '1080p';
        info.qualityValue = 3;
    } else if (title.match(/720p/i)) {
        info.quality = '720p';
        info.qualityValue = 2;
    } else if (title.match(/480p/i)) {
        info.quality = '480p';
        info.qualityValue = 1;
    }
    
    // الكودك
    if (title.match(/x265|HEVC/i)) info.codec = 'HEVC';
    else if (title.match(/AV1/i)) info.codec = 'AV1';
    else if (title.match(/VP9/i)) info.codec = 'VP9';
    
    // الصوت
    if (title.match(/DDP5\.1|Dolby Digital Plus/i)) info.audio = 'DDP5.1';
    else if (title.match(/DTS-HD|DTS-HD MA/i)) info.audio = 'DTS-HD MA';
    else if (title.match(/TrueHD/i)) info.audio = 'TrueHD';
    else if (title.match(/AC3|Dolby Digital/i)) info.audio = 'AC3';
    else if (title.match(/AAC/i)) info.audio = 'AAC';
    
    // اللغة
    if (title.match(/Arabic|AR/i)) info.language = 'Arabic';
    else if (title.match(/French|FR/i)) info.language = 'French';
    else if (title.match(/Spanish|ES/i)) info.language = 'Spanish';
    else if (title.match(/Multi/i)) info.language = 'Multi';
    
    // الترجمة
    if (title.match(/Arabic Subs|AR-Subs/i)) info.subs = 'AR';
    else if (title.match(/French Subs|FR-Subs/i)) info.subs = 'FR';
    else if (title.match(/Spanish Subs|ES-Subs/i)) info.subs = 'ES';
    else if (title.match(/Multi Subs/i)) info.subs = 'Multi';
    
    // الحجم
    const sizeMatch = title.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    if (sizeMatch) {
        const num = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[3].toUpperCase();
        info.size = `${num} ${unit}`;
        info.sizeInBytes = unit === 'GB' ? num * 1024 * 1024 * 1024 : num * 1024 * 1024;
    }
    
    // الـSeeders
    const seedersMatch = title.match(/(\d+)\s*Seeds?/i) || 
                        title.match(/Seeds?:?\s*(\d+)/i);
    if (seedersMatch) info.seeders = parseInt(seedersMatch[1]);
    
    return info;
}

// 5. دالة جلب اسم الفيلم من OMDB
async function getMovieTitle(imdbId) {
    try {
        // إذا كان IMDB ID
        if (imdbId.startsWith('tt')) {
            const omdbUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=YOUR_OMDB_API`;
            const response = await fetch(omdbUrl);
            const data = await response.json();
            
            if (data.Title) {
                return `${data.Title} (${data.Year})`;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

// 6. صفحة الرئيسية
app.get('/', (req, res) => {
    res.send(`
        <h1>🎬 souhail-stremio</h1>
        <p><strong>Install URL:</strong> <code>https://${req.hostname}/manifest.json</code></p>
        <p><strong>Real-Debrid:</strong> ${RD_KEY ? '✅' : '❌'}</p>
        <hr>
        <h3>Test Links:</h3>
        <a href="/stream/movie/tt1375666.json">Inception</a><br>
        <a href="/stream/movie/tt0816692.json">Interstellar</a>
    `);
});

// 7. Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ================================
    🚀 souhail-stremio
    ================================
    Port: ${PORT}
    URL: http://localhost:${PORT}
    RD: ${RD_KEY ? '✅' : '❌'}
    ================================
    `);
});
