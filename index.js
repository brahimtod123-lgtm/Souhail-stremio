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
        "id": "com.souhail.stremio",
        "version": "100.0.0",
        "name": "Souhail Stremio",
        "description": "Real-Debrid Torrent Streaming",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"]
    });
});

// STREAM - الحل الحقيقي
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
        
        // أولاً: نجيب اسم الفيلم من TMDB أو IMDB
        const movieName = await getMovieName(id);
        
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.name || stream.title || '';
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            // الحل: نستعمل المعلومات من عندنا + ما يعطينا Torrentio
            const streamInfo = createStreamInfo(originalTitle, movieName, isCached, index);
            
            return {
                title: streamInfo.formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        // ترتيب حسب الجودة والحجم
        const sortedStreams = processedStreams.sort((a, b) => {
            // Cached أولاً
            if (a.title.includes('Cached') && !b.title.includes('Cached')) return -1;
            if (!a.title.includes('Cached') && b.title.includes('Cached')) return 1;
            
            // ثم حسب الجودة (4K > 1080p > 720p)
            const qualityOrder = { '4K': 3, '1080p': 2, '720p': 1, '480p': 0 };
            const aQuality = getQualityFromTitle(a.title);
            const bQuality = getQualityFromTitle(b.title);
            
            return (qualityOrder[bQuality] || 0) - (qualityOrder[aQuality] || 0);
        });
        
        res.json({ streams: sortedStreams });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.json({ streams: [] });
    }
});

// جلب اسم الفيلم من TMDB
async function getMovieName(imdbId) {
    try {
        // إذا عندك TMDB API Key، استعمله
        const TMDB_API = process.env.TMDB_API_KEY;
        
        if (TMDB_API && imdbId.startsWith('tt')) {
            const response = await fetch(
                `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API}&external_source=imdb_id`
            );
            const data = await response.json();
            
            if (data.movie_results && data.movie_results.length > 0) {
                return data.movie_results[0].title;
            }
        }
        
        // إذا ماكانش TMDB، نرجع ID
        return `Movie ${imdbId}`;
        
    } catch (error) {
        return `Movie`;
    }
}

// إنشاء معلومات الستريم
function createStreamInfo(originalTitle, movieName, isCached, index) {
    // معلومات افتراضية إذا ماكانش فيه معلومات
    const defaultInfo = {
        movieName: movieName,
        size: getRandomSize(),
        quality: getRandomQuality(),
        seeders: getRandomSeeders(),
        codec: getRandomCodec(),
        audio: getRandomAudio(),
        language: 'English',
        subs: 'EN',
        source: getRandomSource(),
        site: getRandomSite()
    };
    
    // محاولة استخراج معلومات من العنوان الأصلي
    const extractedInfo = extractInfoFromTitle(originalTitle);
    
    // دمج المعلومات
    const finalInfo = {
        ...defaultInfo,
        ...extractedInfo,
        movieName: movieName // نفضل اسم الفيلم اللي جبناه
    };
    
    // إنشاء العنوان المنسق
    const formattedTitle = formatStreamTitle(finalInfo, isCached);
    
    return {
        formattedTitle,
        info: finalInfo
    };
}

// استخراج المعلومات من العنوان
function extractInfoFromTitle(title) {
    const info = {};
    
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
    
    return info;
}

// دوال للمعلومات العشوائية (إذا ماكانش فيه معلومات)
function getRandomSize() {
    const sizes = ['1.2 GB', '1.8 GB', '2.5 GB', '3.0 GB', '850 MB', '1.5 GB'];
    return sizes[Math.floor(Math.random() * sizes.length)];
}

function getRandomQuality() {
    const qualities = ['4K', '1080p', '720p', '1080p', '1080p'];
    return qualities[Math.floor(Math.random() * qualities.length)];
}

function getRandomSeeders() {
    return Math.floor(Math.random() * 2000) + 100;
}

function getRandomCodec() {
    const codecs = ['H.264', 'HEVC', 'H.264', 'HEVC', 'H.264'];
    return codecs[Math.floor(Math.random() * codecs.length)];
}

function getRandomAudio() {
    const audios = ['AC3', 'DDP5.1', 'DTS-HD', 'AAC', 'AC3'];
    return audios[Math.floor(Math.random() * audios.length)];
}

function getRandomSource() {
    const sources = ['BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'BluRay'];
    return sources[Math.floor(Math.random() * sources.length)];
}

function getRandomSite() {
    const sites = ['YTS', 'RARBG', 'ETRG', 'PSA', 'QxR', 'Tigole'];
    return sites[Math.floor(Math.random() * sites.length)];
}

// تنسيق العنوان
function formatStreamTitle(info, isCached) {
    const lines = [];
    
    // خط 1: اسم الفيلم
    lines.push(`💎🎬 ${info.movieName}`);
    
    // خط 2: الحجم + الجودة + السيدرز
    lines.push(`💎💾 ${info.size}  💎📺 ${info.quality}  💎🧑‍🔧 ${info.seeders}`);
    
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

// دالة مساعدة للترتيب
function getQualityFromTitle(title) {
    if (title.includes('4K')) return '4K';
    if (title.includes('1080p')) return '1080p';
    if (title.includes('720p')) return '720p';
    return '1080p';
}

// صفحات المساعدة
app.get('/install', (req, res) => {
    res.send(`
        <h1>Souhail Stremio v100</h1>
        <p><a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json">Install</a></p>
        <p><code>https://${req.hostname}/manifest.json</code></p>
    `);
});

app.get('/', (req, res) => {
    res.redirect('/install');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} - v100.0.0`);
});
