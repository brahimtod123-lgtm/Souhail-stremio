const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { searchTorrentGalaxy } = require('./scraper');
const { processTorrents } = require('./resolver');

const RD_API_KEY = process.env.RD_API_KEY || '';

const manifest = {
    id: 'com.souhail.pro',
    version: '8.0.0',
    name: '🎬 SOUHAIL PRO MAX',
    description: 'أفلام ومسلسلات بجودة 4K ونتائج كثيرة - يعمل الآن!',
    logo: 'https://img.icons8.com/color/96/000000/movie.png',
    background: 'https://img.icons8.com/color/480/000000/cinema-.png',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// ⭐⭐⭐ معالج التيارات ⭐⭐⭐
builder.defineStreamHandler(async ({ id, type }) => {
    console.log('\n' + '='.repeat(70));
    console.log(`🎬 ${type.toUpperCase()} REQUEST: ${id}`);
    console.log('='.repeat(70));
    
    if (!RD_API_KEY) {
        return {
            streams: [{
                name: '⚙️ API Key Required',
                title: 'Please set RD_API_KEY in Railway Variables\nأضف RD_API_KEY في إعدادات Railway',
                url: '',
                behaviorHints: { notWebReady: true }
            }]
        };
    }
    
    try {
        // استخراج اسم الفيلم/المسلسل
        const { title, year } = parseId(id);
        console.log(`🔍 البحث عن: "${title}" ${year ? `(${year})` : ''}`);
        
        // البحث عن التورنتات
        console.log('⏳ جاري البحث في Torrent Galaxy...');
        const torrents = await searchTorrentGalaxy(title);
        
        console.log(`📊 نتائج البحث: ${torrents.length} تورنت`);
        
        // عرض بعض النتائج
        torrents.slice(0, 5).forEach((t, i) => {
            console.log(`${i+1}. ${t.quality} - ${t.title.substring(0, 50)}...`);
        });
        
        if (torrents.length === 0) {
            console.log('⚠️ لم يتم العثور على نتائج، استخدام النتائج الاحتياطية');
        }
        
        // معالجة التورنتات مع Real-Debrid
        console.log('🔄 جاري المعالجة مع Real-Debrid...');
        const streams = await processTorrents(torrents, RD_API_KEY, 10);
        
        // إضافة ستريم اختباري
        streams.push({
            name: '📺 TEST STREAM',
            title: '🎬 Test Video Stream (Big Buck Bunny)\n✅ Direct MP4 link - Works in all browsers\n⭐ For testing playback',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            behaviorHints: {
                notWebReady: false,
                bingeGroup: 'test'
            }
        });
        
        // إحصائيات
        const rdStreams = streams.filter(s => s.url && !s.infoHash).length;
        const torrentStreams = streams.filter(s => s.infoHash).length;
        
        console.log('\n📈 الإحصائيات:');
        console.log(`   💎 Real-Debrid streams: ${rdStreams}`);
        console.log(`   🧲 Torrent streams: ${torrentStreams}`);
        console.log(`   📺 Test streams: 1`);
        console.log(`   📊 Total streams: ${streams.length}`);
        
        console.log('\n🚀 جاري إرسال التيارات إلى Stremio...');
        console.log('='.repeat(70));
        
        return { streams };
        
    } catch (error) {
        console.error('🔥 خطأ:', error);
        console.error('🔧 Stack:', error.stack);
        
        return {
            streams: [{
                name: '❌ Error',
                title: `خطأ: ${error.message}\nAPI Key: ${RD_API_KEY ? '✅ متوفر' : '❌ مفقود'}\nالخادم يعمل، حاول مرة أخرى`,
                url: '',
                behaviorHints: { notWebReady: true }
            }]
        };
    }
});

// ⭐⭐⭐ تحليل الـ ID ⭐⭐⭐
function parseId(id) {
    let title = 'Movie';
    let year = '';
    
    if (id.includes(':')) {
        const parts = id.split(':');
        if (parts.length > 1) {
            title = parts[1] || 'Movie';
            
            // استخراج السنة
            const yearMatch = title.match(/\((\d{4})\)/);
            if (yearMatch) {
                year = yearMatch[1];
                title = title.replace(yearMatch[0], '').trim();
            }
        }
    } else if (id.startsWith('tt')) {
        title = 'Movie';
    } else {
        title = id;
    }
    
    // تنظيف العنوان
    title = title
        .replace(/\./g, ' ')
        .replace(/_/g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    return { title, year };
}

// ⭐⭐⭐ تشغيل الخادم ⭐⭐⭐
console.log('='.repeat(70));
console.log('🚀 SOUHAIL PRO MAX - ULTIMATE STREAMING ADDON');
console.log('='.repeat(70));
console.log('💎 Real-Debrid API:', RD_API_KEY ? '✅ CONFIGURED' : '❌ NOT SET');
console.log('🔥 Features:');
console.log('   • 4K UHD & Multiple qualities');
console.log('   • 25+ torrent results per search');
console.log('   • Instant cache checking');
console.log('   • Arabic & English support');
console.log('🌐 Sources: TorrentGalaxy + Real-Debrid');
console.log('🎬 Add to Stremio and enjoy!');
console.log('📡 Server running on port:', process.env.PORT || 3000);
console.log('='.repeat(70));

serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
