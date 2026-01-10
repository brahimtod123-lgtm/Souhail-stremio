const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// مانيفست بدون configure فresources
const manifest = {
    id: 'com.souhail.archive',
    version: '2.0.0',
    name: 'Souhail Archive',
    description: 'Torrents with Real-Debrid',
    logo: 'https://img.icons8.com/color/96/000000/movie.png',
    resources: ['stream'], // ⭐ فقط stream
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// ⭐⭐⭐ Stream Handler مع Configuration فـ query string ⭐⭐⭐
builder.defineStreamHandler(async ({ type, id, config, extra }) => {
    console.log('='.repeat(60));
    console.log('🎬 Request:', type, '-', id);
    
    // ⭐⭐⭐ Configuration من query parameters ⭐⭐⭐
    const apiKey = extra?.api_key || process.env.RD_API_KEY;
    const quality = extra?.quality || '1080p';
    const language = extra?.language || 'all';
    
    console.log('⚙️ Config:', { 
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'Not set',
        quality, 
        language 
    });
    
    // ⭐⭐⭐ تحقق من API key ⭐⭐⭐
    if (!apiKey || apiKey.length < 20) {
        console.log('❌ No valid API key');
        return {
            streams: [{
                name: '⚙️ Configuration Required',
                title: `REAL-DEBRID API KEY REQUIRED!\n\nAdd your API key to the URL:\n\nFormat: /stream/movie/{id}.json?api_key=YOUR_KEY\n\nGet key from: real-debrid.com/apitoken`,
                url: '',
                behaviorHints: { notWebReady: false }
            }]
        };
    }
    
    try {
        // استخراج اسم الفيلم
        let movieName = id;
        let year = '';
        
        if (id.includes(':')) {
            const parts = id.split(':');
            if (parts.length > 1) {
                const nameWithYear = parts[1];
                const yearMatch = nameWithYear.match(/\((\d{4})\)/);
                if (yearMatch) {
                    year = yearMatch[1];
                    movieName = nameWithYear.replace(/\(\d{4}\)/, '').trim();
                } else {
                    movieName = nameWithYear.trim();
                }
            }
        }
        
        console.log(`🔍 Searching: "${movieName}" ${year ? `(${year})` : ''}`);
        
        // ⭐⭐⭐ محاكاة البحث ⭐⭐⭐
        const torrents = [
            {
                title: `${movieName} (${year || '2024'}) 1080p WEB-DL`,
                size: '2.5 GB',
                seeders: 150,
                quality: '1080p',
                language: 'English',
                magnet: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Example',
                source: 'SOUHAIL',
                cached: true
            },
            {
                title: `${movieName} (${year || '2024'}) 4K UHD`,
                size: '15 GB',
                seeders: 85,
                quality: '4K',
                language: 'English',
                magnet: 'magnet:?xt=urn:btih:dd750a5c5a7d9f6d3a0f8e7d2b1c0a9f8e7d2b1c&dn=Example-4K',
                source: 'SOUHAIL',
                cached: false
            }
        ];
        
        // ⭐⭐⭐ تصفية حسب الإعدادات ⭐⭐⭐
        let filtered = torrents;
        if (quality && quality !== 'all') {
            filtered = filtered.filter(t => 
                t.quality && t.quality.toLowerCase().includes(quality)
            );
        }
        if (language && language !== 'all') {
            filtered = filtered.filter(t => 
                t.language && t.language.toLowerCase().includes(language)
            );
        }
        
        console.log(`🎯 Filtered to: ${filtered.length} torrents`);
        
        // ⭐⭐⭐ محاكاة Real-Debrid ⭐⭐⭐
        const streams = filtered.map(torrent => ({
            name: torrent.cached ? '💎 RD Cached' : '🧲 Torrent',
            title: formatStreamTitle(torrent, apiKey),
            url: torrent.cached ? 'https://example.com/stream.mpd' : '',
            ...(torrent.magnet && !torrent.cached ? {
                infoHash: extractInfoHash(torrent.magnet),
                fileIdx: 0
            } : {}),
            behaviorHints: {
                notWebReady: !torrent.cached,
                bingeGroup: `souhail_${type}`
            }
        }));
        
        console.log(`🚀 Sending ${streams.length} streams`);
        return { streams };
        
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            streams: [{
                name: '❌ Error',
                title: `Error: ${error.message}`,
                url: ''
            }]
        };
    }
});

// دوال مساعدة
function formatStreamTitle(torrent, apiKey) {
    const parts = [];
    parts.push(`🎬 ${torrent.title || 'Unknown'}`);
    if (torrent.quality) parts.push(`📊 ${torrent.quality}`);
    if (torrent.size) parts.push(`💾 ${torrent.size}`);
    if (torrent.seeders) parts.push(`👤 ${torrent.seeders} seeds`);
    if (torrent.language) parts.push(`🌍 ${torrent.language}`);
    parts.push(torrent.cached ? '✅ RD Cached' : '⚠️ Needs RD');
    parts.push(`🔑 API: ${apiKey.substring(0, 8)}...`);
    
    return parts.join(' | ');
}

function extractInfoHash(magnet) {
    const match = magnet.match(/btih:([a-fA-F0-9]{40})/);
    return match ? match[1].toLowerCase() : null;
}

// تشغيل الخادم
console.log('='.repeat(60));
console.log('🚀 Souhail Archive - Real-Debrid Ready');
console.log('📡 Configuration via URL parameters:');
console.log('   ?api_key=YOUR_KEY&quality=1080p&language=english');
console.log('🔗 Example URL:');
console.log('   /stream/movie/tt1234567.json?api_key=YOUR_KEY&quality=1080p');
console.log('='.repeat(60));

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
