const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { searchTorrentGalaxy } = require('./scraper');
const { getRealDebridStream } = require('./resolver');

const RD_API_KEY = process.env.RD_API_KEY || '';

const manifest = {
    id: 'com.souhail.pro',
    version: '6.0.0',
    name: '🎬 SOUHAIL PRO',
    description: 'أفلام ومسلسلات مع Real-Debrid',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ id }) => {
    console.log('\n' + '='.repeat(60));
    console.log('🎬 طلب فيلم:', id);
    
    if (!RD_API_KEY) {
        return {
            streams: [{
                name: '⚙️ مفتاح API مطلوب',
                title: 'أضف RD_API_KEY في Railway Variables',
                url: ''
            }]
        };
    }
    
    try {
        // استخراج اسم الفيلم
        const movieName = extractMovieName(id);
        console.log(`🔍 اسم الفيلم: ${movieName}`);
        
        // ⭐⭐⭐ البحث الحقيقي ⭐⭐⭐
        console.log('⏳ جاري البحث في قواعد البيانات...');
        const torrents = await searchTorrentGalaxy(movieName);
        
        console.log(`📥 نتائج البحث: ${torrents.length} تورنت`);
        
        if (torrents.length === 0) {
            return {
                streams: [{
                    name: '❌ لا توجد نتائج',
                    title: `لم يتم العثور على نتائج لـ "${movieName}"\nجرب فيلم آخر`,
                    url: ''
                }]
            };
        }
        
        // عرض أول 5 نتائج في الكونسول
        console.log('🏆 أفضل النتائج:');
        torrents.slice(0, 5).forEach((t, i) => {
            console.log(`${i+1}. ${t.quality} - ${t.title.substring(0, 50)}...`);
        });
        
        // ⭐⭐⭐ معالجة مع Real-Debrid ⭐⭐⭐
        const streams = [];
        const processedCount = Math.min(torrents.length, 8); // معالجة أول 8 تورنتات
        
        for (let i = 0; i < processedCount; i++) {
            const torrent = torrents[i];
            console.log(`🔄 [${i+1}/${processedCount}] معالجة: ${torrent.quality}...`);
            
            const rdResult = await getRealDebridStream(torrent.magnet, RD_API_KEY);
            
            if (rdResult && rdResult.cached) {
                // Real-Debrid cached
                streams.push({
                    name: `💎 ${torrent.quality}`,
                    title: `🎬 ${torrent.title}\n📊 ${torrent.quality} | 💾 ${torrent.size}\n✅ مباشر من Real-Debrid`,
                    url: rdResult.streamUrl,
                    behaviorHints: { notWebReady: false }
                });
            } else {
                // Torrent فقط
                streams.push({
                    name: `🧲 ${torrent.quality}`,
                    title: `🎬 ${torrent.title}\n📊 ${torrent.quality} | 💾 ${torrent.size}\n⚠️ أضف إلى Real-Debrid`,
                    infoHash: torrent.info_hash || extractHash(torrent.magnet),
                    fileIdx: 0,
                    behaviorHints: { notWebReady: true }
                });
            }
            
            // انتظر قليلاً بين الطلبات
            if (i < processedCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log(`🚀 إرسال ${streams.length} تيار`);
        return { streams };
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        return {
            streams: [{
                name: '❌ خطأ',
                title: `خطأ: ${error.message}`,
                url: ''
            }]
        };
    }
});

// ⭐⭐⭐ دوال مساعدة ⭐⭐⭐
function extractMovieName(id) {
    if (id.includes(':')) {
        const parts = id.split(':');
        return parts[1] ? parts[1].replace(/\(\d{4}\)/, '').trim() : 'فيلم';
    }
    return 'فيلم';
}

function extractHash(magnet) {
    const match = magnet.match(/btih:([a-fA-F0-9]{40})/);
    return match ? match[1] : 'hash';
}

// ⭐⭐⭐ تشغيل ⭐⭐⭐
console.log('='.repeat(60));
console.log('🚀 SOUHAIL PRO - جاهز للعمل');
console.log('💎 Real-Debrid:', RD_API_KEY ? '✅ متصل' : '❌ غير متوفر');
console.log('🎬 أدخل أي فيلم في Stremio');
console.log('='.repeat(60));

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
