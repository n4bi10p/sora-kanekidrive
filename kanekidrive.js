const BASE = "https://n4bi10p.vercel.app";

/**
 * SEARCH → resolve IDs → group by show folder
 */
export async function searchResults(keyword) {
  if (!keyword || !keyword.trim()) return [];

  const res = await fetch(
    `${BASE}/api/search?q=${encodeURIComponent(keyword)}`
  );

  const items = await res.json();
  const shows = new Map();

  for (const item of items) {
    if (!item.id) continue;

    // 🔑 Resolve full path using existing index API
    const itemRes = await fetch(`${BASE}/api/item?id=${item.id}`);
    const data = await itemRes.json();

    if (!data.path) continue;

    // Expected path:
    // /BotUpload/Streaming/Bleach/S01/Bleach.S01E14.mkv
    const parts = data.path.split("/");
    const streamingIndex = parts.indexOf("Streaming");
    if (streamingIndex === -1) continue;

    const show = parts[streamingIndex + 1];
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

/**
 * DETAILS → list episodes
 */
export async function loadDetails(showPath) {
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

/**
 * STREAM → OneDrive raw
 */
export async function loadStreams(filePath) {
  return [
    {
      url: `${BASE}/api/raw/?path=${filePath}`,
      quality: "Auto",
      type: "MP4"
    }
  ];
}
