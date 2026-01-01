const BASE = "https://n4bi10p.vercel.app";

async function searchResults(keyword) {
  if (!keyword || !keyword.trim()) return [];

  const res = await fetch(
    `${BASE}/api/search?q=${encodeURIComponent(keyword)}`
  );

  const items = await res.json();
  const shows = new Map();

  for (const item of items) {
    if (!item.id) continue;

    // resolve full path (index-style)
    const itemRes = await fetch(`${BASE}/api/item?id=${item.id}`);
    const data = await itemRes.json();
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

  return Array.from(shows.values());
}

async function loadDetails(showPath) {
  const seasonRes = await fetch(
    `${BASE}/api/list?path=${encodeURIComponent(showPath)}`
  );

  const seasons = await seasonRes.json();
  const episodes = [];

  for (const season of seasons) {
    const epRes = await fetch(
      `${BASE}/api/list?path=${encodeURIComponent(season.path)}`
    );

    const eps = await epRes.json();
    for (const ep of eps) {
      episodes.push({
        title: ep.title,
        href: ep.path
      });
    }
  }

  return episodes;
}

async function loadStreams(filePath) {
  return [
    {
      url: `${BASE}/api/raw/?path=${filePath}`,
      quality: "Auto",
      type: "MP4"
    }
  ];
}

/* 🔑 THIS IS THE CRITICAL PART */
globalThis.searchResults = searchResults;
globalThis.loadDetails = loadDetails;
globalThis.loadStreams = loadStreams;
