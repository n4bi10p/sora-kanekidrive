const BASE = "https://n4bi10p.vercel.app";
const RAW = `${BASE}/api/raw/?path=`;

/**
 * Source-scoped search (Sora calls this)
 */
export async function search(query) {
  if (!query || !query.trim()) return [];

  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(query)}`
  );

  const files = await res.json();

  if (!files.length) return [];

  // group by series name (before SxxExx)
  const map = new Map();

  for (const file of files) {
    const match = file.title.match(/^(.*?)(?:\.S\d{1,2}E\d{1,3})/i);
    const title = match ? match[1].replace(/\./g, ' ').trim() : query;

    if (!map.has(title)) {
      map.set(title, {
        id: title.toLowerCase().replace(/\s+/g, '-'),
        title,
        type: "anime",
        poster: "https://n4bi10p.vercel.app/favicon.ico"
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Called when user opens a search result
 */
export async function load(media) {
  const res = await fetch(
    `${BASE}/api/sora-search?q=${encodeURIComponent(media.title)}`
  );

  const files = await res.json();

  const episodes = files
    .map(file => {
      const match = file.title.match(/E(\d{1,3})/i);
      if (!match) return null;

      return {
        id: file.path,
        number: parseInt(match[1]),
        title: `Episode ${parseInt(match[1])}`,
        file
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

  return {
    episodes
  };
}

/**
 * Called when user clicks episode
 */
export async function getStreams(episode) {
  return [
    {
      url: RAW + episode.file.path,
      quality: "Auto",
      type: "MP4",
      headers: {
        Referer: BASE
      }
    }
  ];
}
