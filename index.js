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

// 1. MANIFEST
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "com.souhail.streamer.full",
        "version": "3.0.0",
        "name": "Souhail Premium",
        "description": "Real-Debrid Torrent Streaming with Full Details",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// 2. STREAM مع كل الإيموجات
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    
    if (!RD_KEY || RD_KEY === 'your_api_key_here') {
        return res.json({ 
            streams: [],
            error: "Real-Debrid API key not configured"
        });
    }
    
    try {
        // جلب من Torrentio
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        // جلب عنوان الفيلم
        const movieInfo = await getMovieInfo(id);
        
        // معالجة كل stream
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.name || stream.title || `Stream ${index + 1}`;
            const info = extractDetailedInfo(originalTitle);
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            // التنسيق مع كل الإيموجات
            const formattedTitle = formatTitleWithEmojis(
                movieInfo.title || originalTitle,
                info,
                isCached
            );
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {},
                // للترتيب
                _size: info.sizeInBytes || 0,
                _quality: info.qualityValue || 0,
                _seeders: info.seeders || 0,
                _isCached: isCached
            };
        });
        
        // الترتيب النهائي
        const sortedStreams = processedStreams.sort((a, b) => {
            // 1. Cached أولاً
            if (b._isCached !== a._isCached) return b._isCached ? 1 : -1;
            // 2. أكبر حجماً
            if (b._size !== a._size) return b._size - a._size;
            // 3. أعلى جودة
            if (b._quality !== a._quality) return b._quality - a._quality;
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

// 3. دالة التنسيق مع كل الإيموجات
function formatTitleWithEmojis(movieTitle, info, isCached) {
    const lines = [];
    
    // الخط 1: اسم الفيلم
    lines.push(`💎🎬 ${movieTitle}`);
    
    // الخط 2: التفاصيل الرئيسية
    const mainDetails = [
        info.size ? `💎💾 ${info.size}` : '💎💾 Unknown',
        `💎📺 ${info.quality}`,
        info.seeders > 0 ? `💎🧑‍🔧 ${info.seeders}` : '💎🧑‍🔧 ?',
        `💎🎞️ ${info.codec}`,
        `💎🎧 ${info.audio}`
    ].join('  ');
    lines.push(mainDetails);
    
    // الخط 3: التفاصيل الثانوية
    const secondaryDetails = [
        `💎🔊 ${info.language}`,
        `💎🌐 ${info.subs}`,
        `💎🎭 ${info.type || 'Movie'}`,
        `💎⭐ ${info.rating || 'N/A'}`,
        `💎⏱️ ${info.duration || 'N/A'}`
    ].join('  ');
    lines.push(secondaryDetails);
    
    // الخط 4: المصدر
    lines.push(isCached ? '💎🧲 RD Cached' : '💎📡 Torrent');
    
    return lines.join('\n');
}

// 4. استخراج معلومات مفصلة
function extractDetailedInfo(title) {
    const info = {
        // الأساسية
        quality: '1080p',
        qualityValue: 3,
        codec: 'H.264',
        audio: 'AC3',
        language: 'English',
        subs: 'EN',
        size: 'Unknown',
        sizeInBytes: 0,
        seeders: 0,
        
        // إضافية
        type: 'Movie',
        rating: 'N/A',
        duration: 'N/A',
        year: '',
        resolution: '',
        hdr: false,
        channels: '2.0',
        group: '',
        source: 'WEB-DL'
    };
    
    if (!title) return info;
    
    // === الجودة والدقة ===
    if (title.match(/4K|UHD/i)) {
        info.quality = '4K';
        info.qualityValue = 5;
        info.resolution = '3840x2160';
    } else if (title.match(/2160p/i)) {
        info.quality = '2160p';
        info.qualityValue = 4;
        info.resolution = '3840x2160';
    } else if (title.match(/1080p|FHD/i)) {
        info.quality = '1080p';
        info.qualityValue = 3;
        info.resolution = '1920x1080';
    } else if (title.match(/720p|HD/i)) {
        info.quality = '720p';
        info.qualityValue = 2;
        info.resolution = '1280x720';
    } else if (title.match(/480p|SD/i)) {
        info.quality = '480p';
        info.qualityValue = 1;
        info.resolution = '854x480';
    }
    
    // === HDR ===
    if (title.match(/HDR10\+/i)) {
        info.hdr = 'HDR10+';
    } else if (title.match(/HDR10/i)) {
        info.hdr = 'HDR10';
    } else if (title.match(/DV|Dolby Vision/i)) {
        info.hdr = 'Dolby Vision';
    }
    
    // === الكودك ===
    if (title.match(/x265|HEVC/i)) info.codec = 'HEVC';
    else if (title.match(/AV1/i)) info.codec = 'AV1';
    else if (title.match(/VP9/i)) info.codec = 'VP9';
    else if (title.match(/x264/i)) info.codec = 'H.264';
    
    // === الصوت ===
    if (title.match(/DDP7\.1|Atmos/i)) {
        info.audio = 'DDP7.1 Atmos';
        info.channels = '7.1';
    } else if (title.match(/DDP5\.1|Dolby Digital Plus/i)) {
        info.audio = 'DDP5.1';
        info.channels = '5.1';
    } else if (title.match(/DTS-HD MA|DTS-HD Master Audio/i)) {
        info.audio = 'DTS-HD MA';
        info.channels = '7.1';
    } else if (title.match(/DTS-HD/i)) {
        info.audio = 'DTS-HD';
        info.channels = '5.1';
    } else if (title.match(/TrueHD/i)) {
        info.audio = 'TrueHD';
        info.channels = '7.1';
    } else if (title.match(/AC3|Dolby Digital/i)) {
        info.audio = 'AC3';
        info.channels = '5.1';
    } else if (title.match(/AAC/i)) {
        info.audio = 'AAC';
        info.channels = '2.0';
    }
    
    // === اللغة ===
    if (title.match(/Arabic|AR|Arabe/i)) {
        info.language = 'Arabic';
    } else if (title.match(/French|FR|Français/i)) {
        info.language = 'French';
    } else if (title.match(/English|EN|Eng/i)) {
        info.language = 'English';
    } else if (title.match(/Spanish|ES|Español/i)) {
        info.language = 'Spanish';
    } else if (title.match(/Multi/i)) {
        info.language = 'Multi';
    }
    
    // === الترجمة ===
    if (title.match(/Arabic Subs|AR-Subs/i)) info.subs = 'AR';
    else if (title.match(/French Subs|FR-Subs/i)) info.subs = 'FR';
    else if (title.match(/English Subs|EN-Subs/i)) info.subs = 'EN';
    else if (title.match(/Spanish Subs|ES-Subs/i)) info.subs = 'ES';
    else if (title.match(/Multi Subs/i)) info.subs = 'Multi';
    
    // === النوع ===
    if (title.match(/S\d+E\d+|Season|Complete Series/i)) {
        info.type = 'Series';
    } else if (title.match(/Anime/i)) {
        info.type = 'Anime';
    }
    
    // === الحجم ===
    const sizeMatch = title.match(/(\d+(\.\d+)?)\s*(GB|MB|GiB|MiB)/i);
    if (sizeMatch) {
        const num = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[3].toUpperCase();
        const isGB = unit.includes('GB') || unit.includes('GIB');
        info.size = `${num} ${isGB ? 'GB' : 'MB'}`;
        info.sizeInBytes = isGB ? num * 1073741824 : num * 1048576;
    }
    
    // === الـSeeders ===
    const seedersMatch = title.match(/(\d+)\s*Seeds?/i) || 
                        title.match(/Seeds?:?\s*(\d+)/i) ||
                        title.match(/S:\s*(\d+)/i);
    if (seedersMatch) info.seeders = parseInt(seedersMatch[1]);
    
    // === السنة ===
    const yearMatch = title.match(/(19|20)\d{2}/);
    if (yearMatch) info.year = yearMatch[0];
    
    // === المجموعة ===
    const groupMatch = title.match(/\[(.*?)\]/);
    if (groupMatch) info.group = groupMatch[1];
    
    // === المصدر ===
    if (title.match(/BluRay|Blu-Ray|BD/i)) info.source = 'BluRay';
    else if (title.match(/WEB-DL|WEB/i)) info.source = 'WEB-DL';
    else if (title.match(/WEBRip/i)) info.source = 'WEBRip';
    else if (title.match(/HDTV/i)) info.source = 'HDTV';
    else if (title.match(/DVD/i)) info.source = 'DVD';
    
    // === التقييم ===
    const ratingMatch = title.match(/(\d+\.?\d*)\/10/i);
    if (ratingMatch) info.rating = ratingMatch[1];
    
    // === المدة ===
    if (title.match(/min/i)) {
        const durationMatch = title.match(/(\d+)\s*min/i);
        if (durationMatch) {
            const mins = parseInt(durationMatch[1]);
            info.duration = `${Math.floor(mins/60)}h ${mins%60}m`;
        }
    }
    
    return info;
}

// 5. جلب معلومات الفيلم
async function getMovieInfo(imdbId) {
    try {
        // استخدام OMDB أو TMDB
        if (imdbId.startsWith('tt')) {
            // يمكنك إضافة OMDB API هنا لاحقاً
            return {
                title: `IMDB: ${imdbId}`,
                year: '',
                rating: ''
            };
        }
        return { title: '', year: '', rating: '' };
    } catch (error) {
        return { title: '', year: '', rating: '' };
    }
}

// 6. صفحة الاختبار
app.get('/test', (req, res) => {
    res.send(`
        <h1>🎬 souhail-stremio Full Details</h1>
        <p>Test the addon with full emoji details:</p>
        <ul>
            <li><a href="/stream/movie/tt1375666.json">Inception - Full Details</a></li>
            <li><a href="/stream/movie/tt0816692.json">Interstellar - Full Details</a></li>
            <li><a href="/stream/movie/tt0468569.json">The Dark Knight - Full Details</a></li>
            <li><a href="/stream/series/tt0944947.json">Game of Thrones - Full Details</a></li>
        </ul>
        <hr>
        <h3>Example Output:</h3>
        <pre>
💎🎬 Inception (2010)
💎💾 1.8 GB  💎📺 1080p  💎🧑‍🔧 1500  💎🎞️ H.264  💎🎧 DDP5.1
💎🔊 English  💎🌐 EN  💎🎭 Movie  💎⭐ 8.8  💎⏱️ 2h 28m
💎🧲 RD Cached
        </pre>
    `);
});

// 7. الصفحة الرئيسية
app.get('/', (req, res) => {
    res.send(`
        <h1>💎 souhail-stremio Premium</h1>
        <p>Stremio Addon with Complete Details Display</p>
        <p><strong>Install URL:</strong></p>
        <code>https://${req.hostname}/manifest.json</code>
        <hr>
        <p><strong>Features:</strong></p>
        <ul>
            <li>💎🎬 Movie/Series Title</li>
            <li>💎💾 File Size</li>
            <li>💎📺 Video Quality (4K, 1080p, etc.)</li>
            <li>💎🧑‍🔧 Seeders Count</li>
            <li>💎🎞️ Codec (H.264, HEVC, etc.)</li>
            <li>💎🎧 Audio Format</li>
            <li>💎🔊 Language</li>
            <li>💎🌐 Subtitles</li>
            <li>💎🎭 Type (Movie/Series/Anime)</li>
            <li>💎⭐ Rating</li>
            <li>💎⏱️ Duration</li>
            <li>💎🧲 RD Cached / 💎📡 Torrent</li>
        </ul>
        <p><a href="/test">Test Page</a></p>
    `);
});

// 8. Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '3.0.0',
        details: 'Full emoji details enabled',
        timestamp: new Date().toISOString() 
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ========================================
    💎 SOUHAIL-STREMIO FULL DETAILS
    ========================================
    📍 Port: ${PORT}
    🌐 URL: http://localhost:${PORT}
    🔗 Install: /manifest.json
    🔑 Real-Debrid: ${RD_KEY ? '✅' : '❌'}
    ========================================
    `);
});
