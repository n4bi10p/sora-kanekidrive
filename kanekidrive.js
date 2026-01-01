const BASE = "https://n4bi10p.vercel.app";

export async function search(query) {
  const res = await fetch(`${BASE}/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  return data.map(item => ({
    id: item.path,
    title: item.title.replace(/\.(mkv|mp4)$/i, ""),
    poster: "https://n4bi10p.vercel.app/favicon.ico",
    type: "anime"
  }));
}

export async function loadAnime(id) {
  return {
    id,
    title: id.split("/").pop(),
    poster: "https://n4bi10p.vercel.app/favicon.ico",
    description: "Streaming from OneDrive",
    type: "anime"
  };
}

export async function loadEpisodes(animeId) {
  const res = await fetch(`${BASE}/api/list?path=${encodeURIComponent(animeId)}`);
  const data = await res.json();

  return data.map((item, i) => ({
    id: item.path,
    number: i + 1,
    title: item.title
  }));
}

export async function loadStream(episodeId) {
  return {
    url: `${BASE}/api/raw?path=${encodeURIComponent(episodeId)}`
  };
}
