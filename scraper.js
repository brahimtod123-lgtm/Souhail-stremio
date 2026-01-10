const axios = require('axios');

// مواقع التورنت
const TORRENT_SITES = [
    {
        name: '1337x',
        url: 'https://1337xx.to/search/{query}/1/',
        parser: parse1337x
    },
    {
        name: 'YTS',
        url: 'https://yts.mx/browse-movies/{query}/all/all/0/latest',
        parser: parseYTS
    },
    {
        name: 'TorrentGalaxy',
        url: 'https://torrentgalaxy.to/torrents.php?search={query}&sort=seeders&order=desc',
        parser: parseTorrentGalaxy
    }
];

async function searchContent(query, year, type = 'movie') {
    console.log(`🔍 Searching for: "${query}" (${type})`);
    
    const searchQuery = year ? `${query} ${year}` : query;
    const allResults = [];
    
    for (const site of TORRENT_SITES) {
        try {
            const searchUrl = site.url.replace('{query}', encodeURIComponent(searchQuery));
            console.log(`🌐 ${site.name}: ${searchUrl}`);
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 10000
            });
            
            const results = site.parser(response.data, site.name);
            console.log(`✅ ${site.name}: ${results.length} results`);
            
            allResults.push(...results);
            
        } catch (error) {
            console.log(`❌ ${site.name} failed: ${error.message}`);
        }
        
        // تأخير بين الطلبات
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // ترتيب النتائج
    return sortResults(allResults);
}

function parse1337x(html, source) {
    const results = [];
    // كود parsing لـ 1337x
    // (نحتاج cheerio ولكن حالياً نرجع بيانات وهمية)
    
    results.push({
        title: 'Example Movie 1080p',
        size: '2.5 GB',
        seeders: 150,
        quality: '1080p',
        language: 'English',
        magnet: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Example',
        source: source
    });
    
    return results;
}

function parseYTS(html, source) {
    return [{
        title: 'Example YTS 1080p',
        size: '1.8 GB',
        seeders: 200,
        quality: '1080p',
        language: 'English',
        magnet: 'magnet:?xt=urn:btih:dd750a5c5a7d9f6d3a0f8e7d2b1c0a9f8e7d2b1c&dn=YTS-Example',
        source: source
    }];
}

function parseTorrentGalaxy(html, source) {
    return [{
        title: 'Example Galaxy 4K',
        size: '15 GB',
        seeders: 85,
        quality: '4K',
        language: 'English',
        magnet: 'magnet:?xt=urn:btih:aa750a5c5a7d9f6d3a0f8e7d2b1c0a9f8e7d2b1c&dn=Galaxy-Example',
        source: source
    }];
}

function sortResults(results) {
    return results.sort((a, b) => {
        // أولوية الجودة
        const qualityOrder = { '4K': 4, '1080p': 3, '720p': 2, 'SD': 1 };
        const aScore = qualityOrder[a.quality] || 0;
        const bScore = qualityOrder[b.quality] || 0;
        
        if (bScore !== aScore) return bScore - aScore;
        return (b.seeders || 0) - (a.seeders || 0);
    });
}

module.exports = { searchContent };
