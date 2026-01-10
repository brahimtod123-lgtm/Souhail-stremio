const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

const manifest = {
    id: 'com.souhail.final',
    version: '1.0.0',
    name: 'SOUHAIL FINAL',
    description: 'Working addon - No axios issues',
    logo: 'https://img.icons8.com/color/96/000000/movie.png',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// ⭐⭐⭐ استخدم fetch بدل axios ⭐⭐⭐
async function searchMovie(query) {
    // محتوى وهمي للاختبار
    return [{
        title: `${query} 1080p`,
        size: '2.5 GB',
        quality: '1080p',
        seeders: 150,
        language: 'English'
    }];
}

builder.defineStreamHandler(async ({ type, id }) => {
    console.log('🎬 Request:', type, '-', id);
    
    // استخراج الاسم
    let movieName = id;
    if (id.includes(':')) {
        const parts = id.split(':');
        if (parts.length > 1) {
            movieName = parts[1].replace(/\(\d{4}\)/, '').trim();
        }
    }
    
    // البحث
    const results = await searchMovie(movieName);
    
    // تحويل للstreams
    const streams = results.map(item => ({
        name: '💎 SOUHAIL',
        title: `🎬 ${item.title}\n📊 ${item.quality} | 💾 ${item.size}\n👤 ${item.seeders} seeds\n🌍 ${item.language}`,
        url: 'https://bitdash-a.akamaihd.net/s/content/media/Manifest.mpd',
        behaviorHints: {
            notWebReady: false
        }
    }));
    
    return { streams };
});

console.log('🚀 SOUHAIL FINAL - Starting without axios...');
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
