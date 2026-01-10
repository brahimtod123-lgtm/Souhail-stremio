const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

// ⭐⭐⭐ MANIFEST المصحح ⭐⭐⭐
const manifest = {
    id: 'com.souhail.archive',
    version: '1.0.0',
    name: 'Souhail Archive',
    description: 'Torrent streaming with Real-Debrid',
    logo: 'https://img.icons8.com/color/96/000000/movie.png',
    resources: ['stream'],
    types: ['movie'],
    idPrefixes: ['tt'],
    
    // ⭐⭐⭐ IMPORTANT: catalogs يجب أن يكون array حتى لو فارغ ⭐⭐⭐
    catalogs: []  // ⬅️ هذا الخطأ كان السبب!
};

const builder = new addonBuilder(manifest);

// Stream handler
builder.defineStreamHandler(({ type, id }) => {
    console.log(`Request: ${type} - ${id}`);
    
    return Promise.resolve({
        streams: [
            {
                name: 'Souhail Archive',
                title: `Stream for ${id} | 1080p | Working`,
                url: 'https://bitdash-a.akamaihd.net/s/content/media/Manifest.mpd',
                behaviorHints: {
                    notWebReady: false
                }
            },
            {
                name: 'Test Stream',
                title: 'Big Buck Bunny - Test Video',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
            }
        ]
    });
});

// Start server
console.log('🚀 Starting Souhail Archive addon...');
serveHTTP(builder.getInterface(), { port: process.env.PORT || 3000 });
