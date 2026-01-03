
const BASE_URL = "https://n4bi10p.vercel.app";

// Helper for Base64 encoding/decoding in environment without Buffer
const Base64 = {
    encode: (str) => {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) { return ""; }
    },
    decode: (str) => {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) { return ""; }
    }
};

class Anilist {
    static async search(keyword, filters = {}) {
        const query = `query (
                $search: String,
                $page: Int,
                $perPage: Int,
                $type: MediaType,
                $isAdult: Boolean
            ) {
                Page(page: $page, perPage: $perPage) {
                media(
                    search: $search,
                    type: $type,
                    isAdult: $isAdult
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    coverImage {
                        extraLarge
                        large
                        medium
                    }
                    description
                    seasonYear
                    bannerImage
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 10,
            "search": keyword,
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async lookup(filters) {
        const query = `query (
                $id: Int
            ) {
                Page(page: 1, perPage: 1) {
                media(
                    id: $id
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    status
                    description
                    seasonYear
                    coverImage {
                        extraLarge
                        large
                    }
                    bannerImage
                }
            }
        }`;

        const variables = {
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async anilistFetch(query, variables) {
        const url = 'https://graphql.anilist.co/';
        try {
            const response = await soraFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response || !response.ok) return null;

            const json = await response.json();
            return json?.data;
        } catch (error) {
            console.error('Error fetching Anilist data:', error);
            return null;
        }
    }
}

async function soraFetch(url, options = {}) {
    try {
        if (typeof fetchv2 !== 'undefined') {
            return await fetchv2(
                url,
                options.headers || {},
                options.method || 'GET',
                options.body || null,
                true,
                options.encoding || 'utf-8'
            );
        } else {
            return await fetch(url, options);
        }
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            console.error("soraFetch failed:", error);
            return null;
        }
    }
}

function cleanFilename(filename) {
    // Remove extension
    let name = filename.replace(/\.[^/.]+$/, "");
    // Remove common release group tags [xxx] or (xxx) or {xxx}
    name = name.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/\{.*?\}/g, "");
    // Remove common keywords
    const keywords = [
        "1080p", "720p", "480p", "4k", "2160p",
        "web", "bluray", "bd", "hdtv",
        "x264", "x265", "hevc", "av1", "h264",
        "aac", "ac3", "dts",
        "dual audio", "multi-audio", "multi audio"
    ];
    const regex = new RegExp(`(${keywords.join("|")})`, "gi");
    name = name.replace(regex, "");

    // Remove sequence of weird characters often found in torrent filenames
    name = name.replace(/[\.\-_]/g, " ");

    return name.trim();
}

async function searchResults(keyword) {
    try {
        const url = `${BASE_URL}/api/search?q=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(url);
        if (!response || !response.ok) return JSON.stringify([]);

        const data = await response.json();

        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data.files || data.folders) {
            items = [...(data.folders || []), ...(data.files || [])];
        }

        // Limit results
        items = items.slice(0, 10);

        const results = await Promise.all(items.map(async (item) => {
            const cleanName = cleanFilename(item.name);
            let image = "";
            let description = "";
            let anilistId = 0;

            try {
                // Fetch metadata from Anilist
                const aniData = await Anilist.search(cleanName, { isAdult: false });
                if (aniData?.Page?.media?.[0]) {
                    const media = aniData.Page.media[0];
                    image = media.coverImage.extraLarge || media.coverImage.large;
                    description = media.description;
                    anilistId = media.id;
                }
            } catch (e) {
                console.log("Metadata fetch failed for " + cleanName);
            }

            // Fallback image
            if (!image) image = "https://via.placeholder.com/300x450.png?text=No+Image";

            // Format: "type|id|anilistId|name"
            const type = item.file ? "file" : "folder";
            const payload = {
                type: type,
                id: item.id || item.path,
                anilistId: anilistId,
                name: item.name
            };

            // Use Base64 helper instead of Buffer
            const href = `kdrv://${Base64.encode(JSON.stringify(payload))}`;

            return {
                title: item.name,
                image: image,
                href: href,
                description: description
            };
        }));

        return JSON.stringify(results);
    } catch (error) {
        console.error("searchResults error:", error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        let payload = {};
        if (url.startsWith("kdrv://")) {
            const base64 = url.replace("kdrv://", "");
            payload = JSON.parse(Base64.decode(base64));
        } else {
            payload = { id: url, type: "file", name: "Unknown" };
        }

        let description = `Watch ${payload.name} on KanekiDrive.`;
        let year = "Unknown";

        if (payload.anilistId) {
            const aniData = await Anilist.lookup({ id: payload.anilistId });
            if (aniData?.Page?.media?.[0]) {
                const media = aniData.Page.media[0];
                description = media.description || description;
                year = media.seasonYear || "Unknown";
            }
        }

        if (description) {
            description = description.replace(/<[^>]+>/g, '');
        }

        const details = [{
            description: description,
            aliases: "Source: OneDrive",
            airdate: `Released: ${year}`
        }];

        return JSON.stringify(details);
    } catch (error) {
        console.error("extractDetails error:", error);
        return JSON.stringify([{
            description: "Error loading details",
            aliases: "",
            airdate: ""
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        let payload = {};
        if (url.startsWith("kdrv://")) {
            const base64 = url.replace("kdrv://", "");
            payload = JSON.parse(Base64.decode(base64));
        } else {
            payload = { id: url, type: "file", name: "Unknown" };
        }

        if (payload.type === 'file') {
            return JSON.stringify([{
                href: url,
                number: 1,
                title: "Movie / Episode"
            }]);
        }

        const listUrl = `${BASE_URL}/api/list?path=${encodeURIComponent(payload.id)}`;

        const response = await soraFetch(listUrl);
        if (!response || !response.ok) return JSON.stringify([]);
        const data = await response.json();

        let files = data.files || [];
        files.sort((a, b) => a.name.localeCompare(b.name));

        const episodes = files.map((f, i) => {
            const epPayload = {
                type: 'file',
                id: f.id,
                name: f.name,
                anilistId: payload.anilistId
            };
            return {
                href: `kdrv://${Base64.encode(JSON.stringify(epPayload))}`,
                number: i + 1,
                title: f.name
            };
        });

        return JSON.stringify(episodes);

    } catch (error) {
        console.error("extractEpisodes error:", error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        let payload = {};
        if (url.startsWith("kdrv://")) {
            const base64 = url.replace("kdrv://", "");
            payload = JSON.parse(Base64.decode(base64));
        } else {
            payload = { id: url };
        }

        const streamUrl = `${BASE_URL}/api/raw?path=${payload.id}&raw=true`;

        const result = {
            streams: [{
                title: "OneDrive Direct",
                streamUrl: streamUrl,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Referer": BASE_URL
                }
            }],
            subtitles: []
        };

        return JSON.stringify(result);
    } catch (error) {
        console.error("extractStreamUrl error:", error);
        return JSON.stringify({ streams: [], subtitles: [] });
    }
}
