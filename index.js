const express = require("express");
const fetch = require("node-fetch");

const app = express();

const PORT = process.env.PORT || 8080;
const RD_KEY = process.env.REAL_DEBRID_API;

console.log(`Starting with PORT: ${PORT}, RD_KEY: ${RD_KEY ? "yes" : "no"}`);

/* =========================
   MANIFEST
========================= */
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "com.souhail.stremio",
    version: "1.0.0",
    name: "Souhail Premium",
    description: "Real-Debrid Streams (Clean & Technical)",
    resources: ["stream"],
    types: ["movie", "series"]
  });
});

/* =========================
   STREAM
========================= */
app.get("/stream/:type/:id.json", async (req, res) => {
  if (!RD_KEY) {
    return res.json({ streams: [] });
  }

  try {
    const torrentioUrl = `https://torrentio.strem.fun/realdebrid=${RD_KEY}/stream/${req.params.type}/${req.params.id}.json`;

    const response = await fetch(torrentioUrl);
    const data = await response.json();

    const streams = (data.streams || []).map((s) => {
      const title = s.title || "";

      return {
        ...s,

        // 🟢 الاسم اللي فيه البول الخضرا
        name: "💥🟢 SOUHAIL / RD 🟢💥",

        // 📋 الترتيب التقني (بلا Seeders)
        title: `
♻️🎬 ${cleanTitle(title)}
♻️📽️ ${extract(title, /(2160p|1080p|720p)/i) || "1080p"}
♻️🎞️ ${extract(title, /(H\.265|H\.264|x265|x264)/i) || "H.264"}
♻️🔊 ${extract(title, /(Atmos|DDP5\.1|DD5\.1|AC3|AAC)/i) || "Audio"}
♻️💾 ${extract(title, /\d+(\.\d+)?\s?(GB|MB)/i) || "Size"}
♻️🌍 EN / AR
♻️⚡ RD Cached
♻️🧲 ${extract(title, /(YTS|RARBG|TPB|ThePirateBay|1337x)/i) || "Torrent"}
        `.trim()
      };
    });

    res.json({ streams });
  } catch (err) {
    console.error("Stream error:", err.message);
    res.json({ streams: [] });
  }
});

/* =========================
   INSTALL
========================= */
app.get("/install", (req, res) => {
  const baseUrl = `https://${req.hostname}`;

  res.send(`
    <h2>Install Souhail Premium</h2>
    <a href="stremio://stremio.xyz/app/${req.hostname}/manifest.json">
      Install Addon
    </a>
    <p>${baseUrl}/manifest.json</p>
  `);
});

app.get("/", (req, res) => {
  res.redirect("/install");
});

/* =========================
   HELPERS
========================= */
function extract(text, regex) {
  const match = text.match(regex);
  return match ? match[0] : null;
}

function cleanTitle(text) {
  return text.split("\n")[0].replace(/\./g, " ").trim();
}

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
