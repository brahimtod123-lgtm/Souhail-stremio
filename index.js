const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;
const NODE_ENV = process.env.NODE_ENV || 'production';

// إزالة warning الـnpm
process.env.NODE_ENV = NODE_ENV;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// 1. HEALTH CHECK - أول شيء
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '10.0.0',
        package: 'souhail-torrent-master@10.0.0',
        addon: 'Souhail Torrent Master v10',
        addon_id: 'org.souhail.torrent.master.v10',
        realdebrid: RD_KEY ? 'configured' : 'not_configured',
        node_env: NODE_ENV,
        timestamp: new Date().toISOString(),
        server: 'Railway'
    });
});

// 2. MANIFEST
app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "org.souhail.torrent.master.v10",
        "version": "10.0.0",
        "name": "Souhail Torrent Master v10",
        "description": "Complete torrent information display with Real-Debrid",
        "logo": "https://cdn-icons-png.flaticon.com/512/3095/3095588.png",
        "background": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c",
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"],
        "behaviorHints": {
            "configurable": true,
            "configurationRequired": false
        },
        "contactEmail": "souhail@torrent-master.com"
    });
});

// 3. STREAM
app.get('/stream/:type/:id.json', async (req, res) => {
    if (!RD_KEY) {
        return res.json({ streams: [] });
    }
    
    try {
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${req.params.type}/${req.params.id}.json`;
        const response = await fetch(torrentioUrl);
        const data = await response.json();
        
        if (!data.streams) {
            return res.json({ streams: [] });
        }
        
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.name || stream.title || `Stream ${index + 1}`;
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            const info = analyzeTitle(originalTitle);
            const formattedTitle = createTitle(info, isCached);
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {}
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch (error) {
        res.json({ streams: [] });
    }
});

// 4. دوال المساعدة
function analyzeTitle(title) {
    return {
        cleanName: getCleanName(title),
        size: getSize(title) || 'Unknown',
        quality: getQuality(title),
        seeders: getSeeders(title),
        codec: getCodec(title),
        audio: getAudio(title),
        language: getLanguage(title),
        subs: getSubtitles(title),
        source: getSource(title),
        site: getSite(title),
        year: getYear(title)
    };
}

function getCleanName(title) {
    let clean = title
        .replace(/\[.*?\]/g, '')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(\d+(\.\d+)?)\s*(GB|MB)/gi, '')
        .replace(/(\d+)\s*Seeds?/gi, '')
        .replace(/4K|1080p|720p|480p/gi, '')
        .replace(/x265|x264|HEVC|AV1/gi, '')
        .replace(/DDP5\.1|DTS-HD|TrueHD|AC3|AAC/gi, '')
        .replace(/BluRay|WEB-DL|WEBRip|HDTV|DVD/gi, '')
        .trim();
    
    return clean.substring(0, 60) || 'Movie/TV Show';
}

function getSize(title) {
    const match = title.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    return match ? match[0] : null;
}

function getQuality(title) {
    if (title.match(/4K/i)) return '4K';
    if (title.match(/1080p/i)) return '1080p';
    if (title.match(/720p/i)) return '720p';
    return '1080p';
}

function getSeeders(title) {
    const match = title.match(/(\d+)\s*Seeds?/i);
    return match ? parseInt(match[1]) : 0;
}

function getCodec(title) {
    return title.match(/x265|HEVC/i) ? 'HEVC' : 'H.264';
}

function getAudio(title) {
    return title.match(/DTS-HD/i) ? 'DTS-HD' : 
           title.match(/AC3/i) ? 'AC3' : 'AAC';
}

function getLanguage(title) {
    return title.match(/Arabic/i) ? 'Arabic' : 
           title.match(/French/i) ? 'French' : 'English';
}

function getSubtitles(title) {
    return title.match(/AR-Subs/i) ? 'AR' : 
           title.match(/FR-Subs/i) ? 'FR' : 'EN';
}

function getSource(title) {
    return title.match(/BluRay/i) ? 'BluRay' : 'WEB-DL';
}

function getSite(title) {
    const match = title.match(/\[(.*?)\]/);
    return match ? match[1] : 'Torrent';
}

function getYear(title) {
    const match = title.match(/(19|20)\d{2}/);
    return match ? match[0] : '';
}

function createTitle(info, isCached) {
    const lines = [];
    lines.push(`🎬 ${info.cleanName}${info.year ? ` (${info.year})` : ''}`);
    lines.push(`💾 ${info.size}  |  📺 ${info.quality}  |  👤 ${info.seeders || '?'}`);
    lines.push(`🎞️ ${info.codec}  |  🔊 ${info.audio}  |  📦 ${info.source}`);
    lines.push(`🌍 ${info.language}  |  📝 ${info.subs}  |  🏷️ ${info.site}`);
    lines.push(isCached ? '✅ REAL-DEBRID CACHED' : '🔗 TORRENT STREAM');
    return lines.join('\n');
}

// 5. INSTALL PAGE
app.get('/install', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Souhail Torrent Master v10</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                .version { background: #28a745; color: white; padding: 5px 10px; border-radius: 3px; }
                .btn { display: inline-block; background: #007bff; color: white; padding: 15px 30px; 
                       border-radius: 5px; text-decoration: none; margin: 20px 0; font-size: 18px; }
                .box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: left; }
                code { background: #e9ecef; padding: 5px; border-radius: 3px; font-family: monospace; }
            </style>
        </head>
        <body>
            <h1>🎬 Souhail Torrent Master</h1>
            <p>Version: <span class="version">10.0.0</span></p>
            <p>Package: <code>souhail-torrent-master@10.0.0</code></p>
            
            <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json" class="btn">
                📲 Install Now
            </a>
            
            <div class="box">
                <p><strong>Manual Install:</strong></p>
                <p>Copy this URL to Stremio:</p>
                <code>https://${req.hostname}/manifest.json</code>
            </div>
            
            <div class="box">
                <p><strong>Status Checks:</strong></p>
                <ul>
                    <li><a href="/health" target="_blank">/health</a> - Server status</li>
                    <li><a href="/manifest.json" target="_blank">/manifest.json</a> - Addon manifest</li>
                    <li><a href="/test" target="_blank">/test</a> - Test page</li>
                    <li>Real-Debrid: ${RD_KEY ? '✅ Configured' : '❌ Not Configured'}</li>
                </ul>
            </div>
        </body>
        </html>
    `);
});

// 6. TEST PAGE
app.get('/test', (req, res) => {
    res.send(`
        <html>
        <body style="font-family: Arial; padding: 20px;">
            <h1>Test v10.0.0</h1>
            <p><a href="/install">← Install Page</a></p>
            <pre style="background: #f8f9fa; padding: 15px;">
🎬 Inception (2010)
💾 1.8 GB  |  📺 1080p  |  👤 1500
🎞️ H.264  |  🔊 DTS-HD  |  📦 BluRay
🌍 English  |  📝 EN  |  🏷️ YTS
✅ REAL-DEBRID CACHED</pre>
            <p><a href="/stream/movie/tt1375666.json" target="_blank">Test Inception</a></p>
        </body>
        </html>
    `);
});

// 7. HOME
app.get('/', (req, res) => {
    res.redirect('/install');
});

// 8. ERROR HANDLER
app.use((req, res) => {
    res.status(404).send('404 - Page not found. Go to <a href="/install">/install</a>');
});

// 9. START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log(`
╔═══════════════════════════════════════════════════════╗
║         SOUHAIL TORRENT MASTER v10.0.0                ║
╠═══════════════════════════════════════════════════════╣
║ 📦 Package:   souhail-torrent-master@10.0.0           ║
║ 🆔 Addon ID:  org.souhail.torrent.master.v10          ║
║ 🌐 Port:      ${PORT}                                 ║
║ 🔗 URL:       http://localhost:${PORT}                ║
║ 📊 Health:    http://localhost:${PORT}/health         ║
║ 📲 Install:   http://localhost:${PORT}/install        ║
║ 🔑 RealDebrid: ${RD_KEY ? '✅ CONFIGURED' : '❌ MISSING'} ║
║ ⚙️  Node Env:  ${NODE_ENV}                            ║
╚═══════════════════════════════════════════════════════╝
    `);
});
