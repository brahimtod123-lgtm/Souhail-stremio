// دالة Real-Debrid
async function getRealDebridStream(magnet, apiKey) {
    try {
        console.log(`🔗 معالجة مع Real-Debrid...`);
        
        // 1. إضافة المغناطيس
        const addRes = await fetch('https://api.real-debrid.com/rest/1.0/torrents/addMagnet', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `magnet=${encodeURIComponent(magnet)}`
        });
        
        if (!addRes.ok) {
            console.log(`❌ RD Add failed: ${addRes.status}`);
            return null;
        }
        
        const addData = await addRes.json();
        const torrentId = addData.id;
        console.log(`📥 Added to RD: ${torrentId}`);
        
        // 2. اختيار الملفات
        await fetch(`https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'files=all'
        });
        
        // 3. انتظار المعالجة
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 4. الحصول على المعلومات
        const infoRes = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!infoRes.ok) {
            await deleteFromRD(torrentId, apiKey);
            return null;
        }
        
        const infoData = await infoRes.json();
        
        // 5. إذا كان محملاً، احصل على الرابط
        if (infoData.status === 'downloaded' && infoData.links && infoData.links.length > 0) {
            console.log(`✅ Cached on RD! Getting link...`);
            
            const unrestrictRes = await fetch('https://api.real-debrid.com/rest/1.0/unrestrict/link', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `link=${encodeURIComponent(infoData.links[0])}`
            });
            
            if (unrestrictRes.ok) {
                const unrestrictData = await unrestrictRes.json();
                
                // تنظيف
                await deleteFromRD(torrentId, apiKey);
                
                return {
                    streamUrl: unrestrictData.download,
                    filename: infoData.filename,
                    size: infoData.bytes,
                    cached: true
                };
            }
        }
        
        // 6. تنظيف
        await deleteFromRD(torrentId, apiKey);
        console.log(`❌ Not cached on RD`);
        return { cached: false };
        
    } catch (error) {
        console.error(`❌ RD Error: ${error.message}`);
        return null;
    }
}

// حذف من RD
async function deleteFromRD(torrentId, apiKey) {
    try {
        await fetch(`https://api.real-debrid.com/rest/1.0/torrents/delete/${torrentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
    } catch (error) {
        // تجاهل
    }
}

// معالجة التورنتات
async function processTorrents(torrents, apiKey) {
    const streams = [];
    
    // معالجة أول 12 تورنت
    const toProcess = torrents.slice(0, 12);
    
    console.log(`🔄 Processing ${toProcess.length} torrents...`);
    
    for (let i = 0; i < toProcess.length; i++) {
        const torrent = toProcess[i];
        
        try {
            console.log(`📦 [${i+1}/${toProcess.length}] ${torrent.quality} - ${torrent.title.substring(0, 50)}...`);
            
            const rdResult = await getRealDebridStream(torrent.magnet, apiKey);
            
            if (rdResult && rdResult.cached) {
                // Real-Debrid cached stream
                const qualityIcon = torrent.quality.includes('4K') ? '🔥' : 
                                  torrent.quality.includes('1080p') ? '💎' : '🎬';
                
                streams.push({
                    name: `${qualityIcon} ${torrent.quality}`,
                    title: `🎬 ${torrent.title}\n📊 ${torrent.quality} | 💾 ${torrent.size} | 👤 ${torrent.seeders} seeds\n✅ DIRECT STREAM READY`,
                    url: rdResult.streamUrl,
                    behaviorHints: {
                        notWebReady: false,
                        bingeGroup: `rd_${i}`
                    }
                });
                
                console.log(`✅ Cached: ${torrent.quality}`);
                
            } else {
                // Torrent فقط
                const qualityIcon = torrent.quality.includes('4K') ? '🎯' : 
                                  torrent.quality.includes('1080p') ? '📀' : '🧲';
                
                streams.push({
                    name: `${qualityIcon} ${torrent.quality}`,
                    title: `🎬 ${torrent.title}\n📊 ${torrent.quality} | 💾 ${torrent.size} | 👤 ${torrent.seeders} seeds\n⚠️ Add to Real-Debrid to stream`,
                    infoHash: extractInfoHash(torrent.magnet),
                    fileIdx: 0,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `torrent_${i}`
                    }
                });
                
                console.log(`⚠️ Torrent only`);
            }
            
            // انتظر بين المعالجات
            if (i < toProcess.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }
    }
    
    return streams;
}

// استخراج الـ infoHash
function extractInfoHash(magnet) {
    const match = magnet.match(/btih:([a-fA-F0-9]{40})/);
    return match ? match[1].toLowerCase() : 'testhash1234567890123456789012345678901234567890';
}

// تصدير الدوال
module.exports = {
    getRealDebridStream,
    processTorrents,
    deleteFromRD,
    extractInfoHash
};
