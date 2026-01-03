
const BASE_URL = "https://n4bi10p.vercel.app";

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
            "perPage": 10, // Limit to avoid hitting limits too fast
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
    // Remove common release group tags [xxx] or (xxx)
    name = name.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "");
    // Remove common keywords
    name = name.replace(/(1080p|720p|4k|web|bluray|x264|x265|hevc|av1)/gi, "");
    // Remove episode numbers if possible (simple heuristic)
    // name = name.replace(/\s\d{2,}\s/, " "); 
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

        // Limit results to top 10 to process metadata without timeout
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
                    // Optionally use proper title
                    // cleanName = media.title.english || media.title.romaji;
                }
            } catch (e) {
                console.log("Metadata fetch failed for " + cleanName);
            }

            // Fallback image so it shows up in Sora
            if (!image) image = "https://via.placeholder.com/300x450.png?text=No+Image";

            // We encode the custom data into a special href format or just pass ID
            // Sora treats href as the key for next steps. 
            // We'll pass a composite or just the ID. 
            // If it's a file, we want to know it's a file.

            // Format: "type|id|anilistId|name"
            const type = item.file ? "file" : "folder";
            const payload = {
                type: type,
                id: item.id || item.path,
                anilistId: anilistId,
                name: item.name
            };

            // Base64 encode payload to be safe in URL-like string
            const href = `kdrv://${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

            return {
                title: item.name, // Keep original filename for clarity or use CleanName
                image: image,
                href: href,
                description: description // Sora might use this in list view?
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
            payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        } else {
            // Fallback if somehow just an ID passed (unlikely with above logic)
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

        // Clean description HTML
        description = description.replace(/<[^>]+>/g, '');

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
            payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        } else {
            payload = { id: url, type: "file", name: "Unknown" };
        }

        // If it's a direct file, return it as a single episode
        if (payload.type === 'file') {
            return JSON.stringify([{
                href: url, // Pass the same payload to stream extraction
                number: 1,
                title: "Movie / Episode"
            }]);
        }

        // If it's a folder, we need to list it (Future implementation: handle recursive folders properly)
        // For now, let's assume valid search hits are files primarily as seen in logs.
        // But if folder, we try to list children.
        const listUrl = `${BASE_URL}/api/list?path=${encodeURIComponent(payload.id)}`; // payload.id might be path or ID
        // Note: OneDrive index might require ID or Path depending on config. User said "files from my onedrive".
        // Debug showed search returning items with IDs.

        const response = await soraFetch(listUrl);
        if (!response || !response.ok) return JSON.stringify([]);
        const data = await response.json();

        let files = data.files || [];
        // Sort
        files.sort((a, b) => a.name.localeCompare(b.name));

        const episodes = files.map((f, i) => {
            const epPayload = {
                type: 'file',
                id: f.id,
                name: f.name,
                anilistId: payload.anilistId // Pass down context
            };
            return {
                href: `kdrv://${Buffer.from(JSON.stringify(epPayload)).toString('base64')}`,
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
            payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        } else {
            // raw ID?
            payload = { id: url };
        }

        // Construct Raw URL.
        // We use ?path=ID because debug showed it redirects correctly for ID too.
        // Or check if it supports ?id= param. Debug script output: 
        // Raw (path=ID) Status: 308
        // Raw (id=ID) Status: 308
        // Both seem to redirect.

        const isM3U8 = payload.name && payload.name.endsWith('.m3u8');

        const streamUrl = `${BASE_URL}/api/raw?path=${payload.id}&raw=true`;
        // Adding &raw=true just in case (standard for some indexers), 
        // otherwise just path usually triggers download/stream.

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
