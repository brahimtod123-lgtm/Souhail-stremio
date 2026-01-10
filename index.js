const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

const RD_API_KEY = process.env.RD_API_KEY || '';

const manifest = {
    id: 'com.souhail.final',
    version: '5.0.0',
    name: '💎 SOUHAIL FINAL',
    description: 'Real-Debrid streams working now',
    logo: 'https://img.icons8.com/color/96/000000/movie.png',
    resources: ['stream'],
    types: ['movie'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// ⭐⭐⭐ دالة لاختبار Real-Debrid API Key ⭐⭐⭐
async function testRDKey(apiKey) {
    if (!apiKey || apiKey.length < 20) return false;
    
    try {
        const response = await fetch('https://api.real-debrid.com/rest/1.0/user', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Real-Debrid valid! User: ${data.username}, Premium: ${data.premium}`);
            return true;
        }
        console.log(`❌ RD Key invalid: ${response.status}`);
        return false;
    } catch (error) {
        console.log(`❌ RD Key test failed: ${error.message}`);
        return false;
    }
}

// ⭐⭐⭐ دالة للبحث في مصادر تعمل على Railway ⭐⭐⭐
async function searchWorkingSources(query) {
    console.log(`🔍 Searching: "${query}"`);
    
    const results = [];
    
    // 1. استخدم PirateBay API (يعمل على Railway)
    try {
        console.log('🌐 Trying PirateBay API...');
        const pbUrl = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=200`;
        const response = await fetch(pbUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                data.forEach(item => {
                    if (item.name && item.seeders > 5) {
                        results.push({
                            title: item.name,
                            size: formatBytes(item.size),
                            seeders: parseInt(item.seeders),
                            quality: detectQuality(item.name),
                            language: detectLanguage(item.name),
                            source: 'PirateBay',
                            magnet: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`,
                            type: 'movie'
                        });
                    }
                });
                console.log(`✅ PirateBay: ${data.length} results`);
            }
        }
    } catch (error) {
        console.log(`❌ PirateBay failed: ${error.message}`);
    }
    
    // 2. استخدم SolidTorrents API
    try {
        console.log('🌐 Trying SolidTorrents API...');
        const stUrl = `https://solidtorrents.net/api/v1/search?q=${encodeURIComponent(query)}&category=video`;
        const response = await fetch(stUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.results) {
                data.results.forEach(item => {
                    if (item.title && item.seeders > 2) {
                        results.push({
                            title: item.title,
                            size: formatBytes(item.size),
                            seeders: item.seeders,
                            quality: detectQuality(item.title),
                            language: detectLanguage(item.title),
                            source: 'SolidTorrents',
                            magnet: item.magnet,
                            type: 'movie'
                        });
                    }
                });
                console.log(`✅ SolidTorrents: ${data.results.length} results`);
            }
        }
    } catch (error) {
        console.log(`❌ SolidTorrents failed: ${error.message}`);
    }
    
    // 3. إذا مافي نتائج، نضيف عينات
    if (results.length === 0) {
        console.log('⚠️ Using sample torrents');
        results.push(
            {
                title: `${query} 1080p WEB-DL`,
                size: '2.5 GB',
                seeders: 150,
                quality: '1080p',
                language: 'English',
                source: 'Sample',
                magnet: `magnet:?xt=urn:btih:SAMPLE1080PHASH&dn=${encodeURIComponent(query)}`,
                type: 'movie'
            }
        );
    }
    
    return results.slice(0, 5); // أول 5 فقط
}

// ⭐⭐⭐ Real-Debrid مع معالجة الأخطاء ⭐⭐⭐
async function resolveWithRD(magnet, apiKey) {
    if (!apiKey) return null;
    
    try {
        console.log(`🔗 Checking RD cache...`);
        
        // أولاً: تحقق من حالة API key
        const userResponse = await fetch('https://api.real-debrid.com/rest/1.0/user', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!userResponse.ok) {
            console.log(`❌ RD Key invalid (${userResponse.status})`);
            return null;
        }
        
        // ثانياً: أضف المغناطيس
        const addResponse = await fetch('https://api.real-debrid.com/rest/1.0/torrents/addMagnet', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `magnet=${encodeURIComponent(magnet)}`
        });
        
        if (!addResponse.ok) {
            const error = await addResponse.text();
            console.log(`❌ RD Add failed (${addResponse.status}):`, error.substring(0, 100));
            return null;
        }
        
        const addData = await addResponse.json();
        const torrentId = addData.id;
        
        // ثالثاً: تحقق من المعلومات
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const infoResponse = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!infoResponse.ok) {
            await deleteFromRD(torrentId, apiKey);
            return null;
        }
        
        const infoData = await infoResponse.json();
        
        // رابعاً: إذا كان cached
        if (infoData.status === 'downloaded' && infoData.links && infoData.links.length > 0) {
            console.log(`✅ Torrent cached on RD!`);
            
            const unrestrictResponse = await fetch('https://api.real-debrid.com/rest/1.0/unrestrict/link', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `link=${encodeURIComponent(infoData.links[0])}`
            });
            
            if (unrestrictResponse.ok) {
                const unrestrictData = await unrestrictResponse.json();
                
                // نظف
                await deleteFromRD(torrentId, apiKey);
                
                return {
                    streamUrl: unrestrictData.download,
                    cached: true,
                    size: infoData.bytes
                };
            }
        }
        
        // نظف إذا ماشي cached
        await deleteFromRD(torrentId, apiKey);
        return { cached: false };
        
    } catch (error) {
        console.error(`❌ RD Error:`, error.message);
        return null;
    }
}

async function deleteFromRD(torrentId, apiKey) {
    try {
        await fetch(`https://api.real-debrid.com/rest/1.0/torrents/delete/${torrentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
    } catch (error) {
        // تجاهل أخطاء الحذف
    }
}

builder.defineStreamHandler(async ({ id }) => {
    console.log('\n' + '='.repeat(60));
    console.log('🎬 Request:', id);
    
    // ⭐⭐⭐ اختبار API key أولاً ⭐⭐⭐
    const isKeyValid = await testRDKey(RD_API_KEY);
    
    if (!isKeyValid) {
        return {
            streams: [{
                name: '❌ Invalid API Key',
                title: `REAL-DEBRID API KEY INVALID!\n\nCurrent key: ${RD_API_KEY ? `${RD_API_KEY.substring(0, 15)}...` : 'Empty'}\n\nPlease check:\n1. Go to real-debrid.com/apitoken\n2. Copy your API key\n3. In Railway: Settings → Variables\n4. Set RD_API_KEY = your_key\n5. Restart the service`,
                url: ''
            }]
        };
    }
    
    try {
        // استخراج اسم الفيلم
        let movieName = 'Movie';
        if (id.includes(':')) {
            const parts = id.split(':');
            if (parts.length > 1) {
                movieName = parts[1].replace(/\(\d{4}\)/, '').trim();
            }
        }
        
        // البحث عن تورنتات
        const torrents = await searchWorkingSources(movieName || 'movie');
        
        if (torrents.length === 0) {
            return {
                streams: [{
                    name: '🔍 No Results',
                    title: 'No torrents found. Try another movie.',
                    url: ''
                }]
            };
        }
        
        // معالجة مع Real-Debrid
        const streams = [];
        
        for (const torrent of torrents.slice(0, 3)) {
            console.log(`Processing: ${torrent.title.substring(0, 40)}...`);
            
            const rdResult = await resolveWithRD(torrent.magnet, RD_API_KEY);
            
            if (rdResult && rdResult.cached) {
                // Real-Debrid cached
                streams.push({
                    name: '💎 REAL-DEBRID',
                    title: `🎬 ${torrent.title}\n📊 ${torrent.quality} | 💾 ${torrent.size}\n👤 ${torrent.seeders} seeds\n✅ CACHED ON REAL-DEBRID\n🔗 Direct stream ready`,
                    url: rdResult.streamUrl,
                    behaviorHints: { notWebReady: false }
                });
            } else {
                // Torrent فقط
                streams.push({
                    name: '🧲 TORRENT',
                    title: `🎬 ${torrent.title}\n📊 ${torrent.quality} | 💾 ${torrent.size}\n👤 ${torrent.seeders} seeds\n⚠️ Add to Real-Debrid to stream\n🔗 Source: ${torrent.source}`,
                    infoHash: extractInfoHash(torrent.magnet),
                    fileIdx: 0,
                    behaviorHints: { notWebReady: true }
                });
            }
        }
        
        console.log(`✅ Sending ${streams.length} streams`);
        return { streams };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            streams: [{
                name: '❌ Error',
                title: `Error: ${error.message}\nRD Key: ${RD_API_KEY ? 'Present' : 'Missing'}`,
                url: ''
            }]
        };
    }
});

// دوال مساعدة
function formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

function detectQuality(title) {
    if (!title) return 'Unknown';
    if (/2160p|4k|uhd/i.test(title)) return '4K';
    if (/1080p|fhd/i.test(title)) return '1080p';
    if (/720p|hd/i.test(title)) return '720p';
    return 'SD';
}

function detectLanguage(title) {
    if (!title) return 'English';
    if (/arabic|عربي|arab/i.test(title)) return 'Arabic';
    if (/french|فرنسي|fren/i.test(title)) return 'French';
    return 'English';
}

function extractInfoHash(magnet) {
    const match = magnet.match(/btih:([a-fA-F0-9]{40})/);
    return match ? match[1].toLowerCase() : null;
}

// تشغيل
console.log('='.repeat(60));
console.log('🚀 SOUHAIL FINAL - READY!');
console.log('💎 RD API Key:', RD_API_KEY ? `✅ ${RD_API_KEY.substring(0, 10)}...` : '❌ Missing');
console.log('🔗 Sources: PirateBay, SolidTorrents');
console.log('🎬 Test: Search any movie in Stremio');
console.log('='.repeat(60));

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
