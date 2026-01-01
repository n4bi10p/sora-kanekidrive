const BASE = "https://n4bi10p.vercel.app";

/**
 * SEARCH → returns anime cards
 */
async function searchResults(keyword) {
  try {
    const res = await fetch(`${BASE}/api/search?q=${encodeURIComponent(keyword)}`);
    const items = await res.json();

    const shows = new Map();

    for (const item of items) {
      if (!item.id) continue;

      // Resolve full path (same as index UI)
      const r = await fetch(`${BASE}/api/item?id=${item.id}`);
      const data = await r.json();
      if (!data.path) continue;

      const parts = data.path.split("/");
      const idx = parts.indexOf("Streaming");
      if (idx === -1) continue;

      const show = parts[idx + 1];
      if (!show) continue;

      if (!shows.has(show)) {
        shows.set(show, {
          title: show,
          image: `${BASE}/favicon.ico`,
          href: `/BotUpload/Streaming/${show}`
        });
      }
    }

    return JSON.stringify([...shows.values()]);
  } catch (e) {
    return JSON.stringify([]);
  }
}

/**
 * DETAILS → anime info page
 */
async function extractDetails(showPath) {
  const title = showPath.split("/").pop();

  return JSON.stringify([{
    description: `Streaming ${title} from OneDrive`,
    aliases: title,
    airdate: "Unknown"
  }]);
}

/**
 * EPISODES → list episodes
 */
async function extractEpisodes(showPath) {
  try {
    const seasonRes = await fetch(
      `${BASE}/api/list?path=${encodeURIComponent(showPath)}`
    );
    const seasons = await seasonRes.json();

    const episodes = [];
    let counter = 1;

    for (const season of seasons) {
      const epRes = await fetch(
        `${BASE}/api/list?path=${encodeURIComponent(season.path)}`
      );
      const eps = await epRes.json();

      for (const ep of eps) {
        episodes.push({
          href: ep.path,
          number: counter++
        });
      }
    }

    return JSON.stringify(episodes);
  } catch (e) {
    return JSON.stringify([]);
  }
}

/**
 * STREAM → resolve OneDrive file
 */
async function extractStreamUrl(filePath) {
  return JSON.stringify({
    streams: [{
      title: "Auto",
      streamUrl: `${BASE}/api/raw/?path=${encodeURIComponent(filePath)}`
    }],
    subtitles: ""
  });
}

/* 🔑 Expose functions globally (script mode) */
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
