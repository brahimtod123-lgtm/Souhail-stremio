const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// MANIFEST مع ID جديد كلياً
app.get('/manifest.json', (req, res) => {
    res.json({
        // ID جديد كلياً - مهم!
        "id": "org.souhail.torrent.fullinfo",
        
        // زد فيرسيون كثير
        "version": "10.0.0",
        
        // غير الإسم كلياً
        "name": "Souhail Torrent Master",
        
        // غير الوصف
        "description": "Complete torrent information with Real-Debrid",
        
        // غير اللوجو
        "logo": "https://raw.githubusercontent.com/feathericons/feather/master/icons/film.svg",
        
        // غير الباكقراوند
        "background": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c",
        
        "resources": ["stream"],
        "types": ["movie", "series"],
        "idPrefixes": ["tt"],
        
        // زد behaviorHints
        "behaviorHints": {
            "configurable": true,
            "configurationRequired": false
        },
        
        // زد contactEmail لوهمي
        "contactEmail": "support@souhail-addon.com"
    });
});

// STREAM مع معلومات كاملة
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    
    if (!RD_KEY) {
        return res.json({ streams: [] });
    }
    
    try {
        const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${type}/${id}.json`;
        const response = await fetch(torrentioUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Torrentio error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.streams || data.streams.length === 0) {
            return res.json({ streams: [] });
        }
        
        const processedStreams = data.streams.map((stream, index) => {
            const originalTitle = stream.name || stream.title || `Torrent ${index + 1}`;
            const isCached = stream.url && stream.url.includes('real-debrid.com');
            
            // تحليل العنوان
            const torrentInfo = analyzeTorrentTitle(originalTitle);
            
            // إنشاء العنوان المنظم
            const formattedTitle = createOrganizedTitle(torrentInfo, isCached);
            
            return {
                title: formattedTitle,
                url: stream.url,
                behaviorHints: stream.behaviorHints || {
                    notWebReady: false,
                    bingeGroup: `souhail-${id}`
                }
            };
        });
        
        res.json({ streams: processedStreams });
        
    } catch (error) {
        console.error('Stream error:', error.message);
        res.json({ streams: [] });
    }
});

// تحليل عنوان التورنت
function analyzeTorrentTitle(title) {
    const info = {
        // معلومات أساسية
        rawTitle: title,
        cleanedTitle: '',
        
        // التقنية
        size: 'Unknown',
        quality: '1080p',
        codec: 'H.264',
        audio: 'AC3',
        
        // المحتوى
        language: 'English',
        subtitles: 'EN',
        source: 'WEB-DL',
        
        // التورنت
        seeders: 0,
        site: 'Torrent Site',
        
        // إضافي
        year: '',
        movieName: '',
        episodeInfo: ''
    };
    
    // تنظيف وتحليل
    info.cleanedTitle = extractMovieName(title);
    info.size = extractSize(title) || 'Unknown';
    info.quality = extractQuality(title);
    info.codec = extractCodec(title);
    info.audio = extractAudio(title);
    info.language = extractLanguage(title);
    info.subtitles = extractSubtitles(title);
    info.source = extractSource(title);
    info.seeders = extractSeeders(title);
    info.site = extractSite(title);
    info.year = extractYear(title);
    
    // إذا كان مسلسلاً
    if (title.match(/S\d+E\d+|Season|Episode/i)) {
        info.episodeInfo = extractEpisodeInfo(title);
    }
    
    return info;
}

// دوال الاستخراج
function extractMovieName(title) {
    // إزالة المعلومات التقنية
    let cleaned = title
        .replace(/\[.*?\]/g, '')      // إزالة الأقواس
        .replace(/\./g, ' ')          // استبدال النقاط
        .replace(/\s+/g, ' ')         // مسافات متعددة
        .replace(/(\d+(\.\d+)?)\s*(GB|MB)/gi, '')  // الحجم
        .replace(/(\d+)\s*Seeds?/gi, '')          // السيدرز
        .replace(/4K|2160p|1080p|720p|480p/gi, '') // الجودة
        .replace(/x265|x264|HEVC|AV1|VP9/gi, '')   // الكودك
        .replace(/DDP5\.1|DTS-HD|TrueHD|AC3|AAC/gi, '') // الصوت
        .replace(/BluRay|WEB-DL|WEBRip|HDTV|DVD/gi, '') // المصدر
        .replace(/(19|20)\d{2}/g, '')              // السنة
        .trim();
    
    // إذا كان طويلاً، نختصره
    if (cleaned.length > 50) {
        cleaned = cleaned.substring(0, 47) + '...';
    }
    
    return cleaned || 'Movie/TV Show';
}

function extractSize(title) {
    const match = title.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    return match ? match[0] : null;
}

function extractQuality(title) {
    if (title.match(/4K|UHD/i)) return '4K';
    if (title.match(/2160p/i)) return '2160p';
    if (title.match(/1080p|FHD/i)) return '1080p';
    if (title.match(/720p|HD/i)) return '720p';
    if (title.match(/480p|SD/i)) return '480p';
    return '1080p';
}

function extractCodec(title) {
    if (title.match(/x265|HEVC/i)) return 'HEVC';
    if (title.match(/AV1/i)) return 'AV1';
    if (title.match(/VP9/i)) return 'VP9';
    return 'H.264';
}

function extractAudio(title) {
    if (title.match(/DDP5\.1|Dolby Digital Plus/i)) return 'DDP5.1';
    if (title.match(/DTS-HD|DTS-HD MA/i)) return 'DTS-HD';
    if (title.match(/TrueHD/i)) return 'TrueHD';
    if (title.match(/AC3|Dolby Digital/i)) return 'AC3';
    if (title.match(/AAC/i)) return 'AAC';
    return 'AC3';
}

function extractLanguage(title) {
    if (title.match(/Arabic|AR|Arabe/i)) return 'Arabic';
    if (title.match(/French|FR|Français/i)) return 'French';
    if (title.match(/Spanish|ES|Español/i)) return 'Spanish';
    if (title.match(/Multi/i)) return 'Multi';
    return 'English';
}

function extractSubtitles(title) {
    if (title.match(/Arabic Subs|AR-Subs/i)) return 'AR';
    if (title.match(/French Subs|FR-Subs/i)) return 'FR';
    if (title.match(/English Subs|EN-Subs/i)) return 'EN';
    if (title.match(/Spanish Subs|ES-Subs/i)) return 'ES';
    if (title.match(/Multi Subs/i)) return 'Multi';
    return 'EN';
}

function extractSource(title) {
    if (title.match(/BluRay|Blu-Ray|BD/i)) return 'BluRay';
    if (title.match(/WEB-DL|WEB/i)) return 'WEB-DL';
    if (title.match(/WEBRip/i)) return 'WEBRip';
    if (title.match(/HDTV/i)) return 'HDTV';
    if (title.match(/DVD/i)) return 'DVD';
    return 'WEB-DL';
}

function extractSeeders(title) {
    const match = title.match(/(\d+)\s*Seeds?/i);
    return match ? parseInt(match[1]) : 0;
}

function extractSite(title) {
    const match = title.match(/\[(.*?)\]/);
    return match ? match[1] : 'Torrent';
}

function extractYear(title) {
    const match = title.match(/(19|20)\d{2}/);
    return match ? match[0] : '';
}

function extractEpisodeInfo(title) {
    const seasonMatch = title.match(/S(\d+)/i);
    const episodeMatch = title.match(/E(\d+)/i);
    
    if (seasonMatch && episodeMatch) {
        return `S${seasonMatch[1]}E${episodeMatch[1]}`;
    }
    return '';
}

// إنشاء العنوان المنظم
function createOrganizedTitle(info, isCached) {
    const lines = [];
    
    // السطر 1: اسم الفيلم/المسلسل + السنة
    let line1 = `🎬 ${info.cleanedTitle}`;
    if (info.year) line1 += ` (${info.year})`;
    if (info.episodeInfo) line1 += ` ${info.episodeInfo}`;
    lines.push(line1);
    
    // السطر 2: الحجم + الجودة + السيدرز
    lines.push(`💾 ${info.size}  |  📺 ${info.quality}  |  👤 ${info.seeders || '?'}`);
    
    // السطر 3: التقنية
    lines.push(`🎞️ ${info.codec}  |  🔊 ${info.audio}  |  📦 ${info.source}`);
    
    // السطر 4: اللغات + الموقع
    lines.push(`🌍 ${info.language}  |  📝 ${info.subtitles}  |  🏷️ ${info.site}`);
    
    // السطر 5: النوع
    lines.push(isCached ? '✅ REAL-DEBRID CACHED' : '🔗 TORRENT STREAM');
    
    return lines.join('\n');
}

// صفحة تنصيب جديدة
app.get('/install', (req, res) => {
    const installUrl = `https://${req.hostname}/manifest.json`;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Install Souhail Torrent Master</title>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    margin: 0;
                }
                
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                
                h1 {
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .subtitle {
                    color: #666;
                    margin-bottom: 30px;
                }
                
                .install-box {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    border-left: 4px solid #28a745;
                }
                
                .install-btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-size: 18px;
                    font-weight: bold;
                    margin: 10px 0;
                    transition: transform 0.3s;
                }
                
                .install-btn:hover {
                    transform: translateY(-2px);
                }
                
                .url-box {
                    background: #e9ecef;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                    font-family: 'Courier New', monospace;
                    word-break: break-all;
                }
                
                .step {
                    text-align: left;
                    margin: 20px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .step h3 {
                    margin-top: 0;
                    color: #495057;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎬 Souhail Torrent Master</h1>
                <p class="subtitle">Complete torrent information with Real-Debrid</p>
                
                <div class="install-box">
                    <h3>📲 Installation</h3>
                    
                    <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json" 
                       class="install-btn">
                        Install Now
                    </a>
                    
                    <p style="margin: 10px 0; color: #666;">Or manually copy this URL:</p>
                    
                    <div class="url-box">
                        ${installUrl}
                    </div>
                </div>
                
                <div class="step">
                    <h3>📋 Installation Steps:</h3>
                    <ol>
                        <li><strong>On PC/Mobile:</strong> Click "Install Now" button above</li>
                        <li><strong>If automatic install fails:</strong> Copy the URL above</li>
                        <li><strong>Open Stremio</strong> and go to Addons section</li>
                        <li><strong>Click "Install from URL"</strong> and paste the URL</li>
                        <li><strong>Click Install</strong> and wait for confirmation</li>
                    </ol>
                </div>
                
                <div class="step">
                    <h3>✅ Features:</h3>
                    <ul>
                        <li>Complete torrent information display</li>
                        <li>Size, quality, seeders count</li>
                        <li>Codec, audio format, language info</li>
                        <li>Real-Debrid cached streams</li>
                        <li>Organized multi-line display</li>
                    </ul>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d;">
                        <a href="/test" style="color: #667eea; text-decoration: none;">Test Page</a> | 
                        <a href="/" style="color: #667eea; text-decoration: none;">Home</a>
                    </p>
                </div>
            </div>
            
            <script>
                // Auto-copy function
                function copyUrl() {
                    navigator.clipboard.writeText('${installUrl}').then(() => {
                        alert('URL copied to clipboard!');
                    });
                }
                
                // Auto-click install button after 2 seconds
                setTimeout(() => {
                    const installBtn = document.querySelector('.install-btn');
                    if (installBtn && !window.location.href.includes('stremio://')) {
                        installBtn.click();
                    }
                }, 2000);
            </script>
        </body>
        </html>
    `);
});

// Test page
app.get('/test', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Test Souhail Addon</title>
            <style>
                body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
                .example { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                pre { white-space: pre-wrap; font-family: monospace; }
            </style>
        </head>
        <body>
            <h1>🧪 Test Page - Souhail Torrent Master</h1>
            <p><a href="/install">← Back to Install</a></p>
            
            <div class="example">
                <h3>Example Output:</h3>
                <pre>
🎬 Inception 2010
💾 1.8 GB  |  📺 1080p  |  👤 1500
🎞️ H.264  |  🔊 DTS-HD  |  📦 BluRay
🌍 English  |  📝 EN  |  🏷️ YTS
✅ REAL-DEBRID CACHED</pre>
            </div>
            
            <h3>Test Links:</h3>
            <ul>
                <li><a href="/stream/movie/tt1375666.json">Inception (tt1375666)</a></li>
                <li><a href="/stream/movie/tt0816692.json">Interstellar (tt0816692)</a></li>
                <li><a href="/stream/movie/tt0468569.json">The Dark Knight (tt0468569)</a></li>
                <li><a href="/stream/series/tt0944947.json">Game of Thrones (tt0944947)</a></li>
            </ul>
            
            <h3>Check Manifest:</h3>
            <ul>
                <li><a href="/manifest.json">manifest.json</a></li>
                <li><a href="/health">Health Check</a></li>
            </ul>
        </body>
        </html>
    `);
});

// Home page
app.get('/', (req, res) => {
    res.redirect('/install');
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        addon: 'Souhail Torrent Master',
        version: '10.0.0',
        realdebrid: RD_KEY ? 'configured' : 'not_configured',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ============================================
    🚀 SOUHAIL TORRENT MASTER v10.0.0
    ============================================
    📍 Port: ${PORT}
    🌐 URL: http://localhost:${PORT}
    🔗 Install: /install
    🆔 ID: org.souhail.torrent.fullinfo
    ============================================
    `);
});
