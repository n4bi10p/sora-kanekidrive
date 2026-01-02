
const BASE_URL = "https://n4bi10p.vercel.app";

async function soraFetch(url, options = {}) {
    try {
        // Sora environment often defines fetchv2
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
            console.error("soraFetch failed completely:", error);
            return null;
        }
    }
}

async function searchResults(keyword) {
    try {
        const url = `${BASE_URL}/api/search?q=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(url);
        if (!response || !response.ok) return JSON.stringify([]);
        
        const data = await response.json();
        
        // onedrive-vercel-index usually returns { files: [], folders: [] } or an array
        // We need to handle various potential responses robustly
        let items = [];
        if (Array.isArray(data)) {
            items = data;
        } else if (data.files || data.folders) {
            items = [...(data.folders || []), ...(data.files || [])];
        }

        // Group/Transform results
        // We prefer folders as "Anime" entries
        const results = items.map(item => {
            return {
                title: item.name || "Unknown",
                image: "", // No image available from simple file index
                href: item.path || item.id // Use path as the identifier
            };
        });

        // Simple deduplication based on href to avoid duplicates if API returns weirdly
        const uniqueResults = [];
        const seen = new Set();
        for (const r of results) {
            if (!seen.has(r.href)) {
                seen.add(r.href);
                uniqueResults.push(r);
            }
        }

        return JSON.stringify(uniqueResults);
    } catch (error) {
        console.error("searchResults error:", error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        // url is the path, e.g., /Anime/Naruto
        // Since we don't have metadata, we return synthetic info as requested
        const name = url.split('/').pop() || "Unknown Title";
        
        const details = [{
            description: `Browse files for ${name} on KanekiDrive.`,
            aliases: "Source: OneDrive",
            airdate: "Unknown"
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
        const episodes = [];
        
        // Helper for recursive listing
        // API: /api/list?path=... (User specified /api/list)
        async function fetchRecursive(currentPath) {
            const listUrl = `${BASE_URL}/api/list?path=${encodeURIComponent(currentPath)}`;
            const response = await soraFetch(listUrl);
            if (!response || !response.ok) return;

            const data = await response.json();
            
            // Handle standard index structure
            const folders = data.folders || [];
            const files = data.files || [];

            // Process files (potential episodes)
            for (const file of files) {
                const name = file.name;
                const ext = name.split('.').pop().toLowerCase();
                if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
                    episodes.push({
                        href: file.path, // Full path for extraction
                        title: name,
                        rawName: name 
                    });
                }
            }

            // Recurse into folders (Seasons, etc.)
            for (const folder of folders) {
                await fetchRecursive(folder.path);
            }
        }

        await fetchRecursive(url);

        // Sort episodes naturally and assign numbers
        // Simple sort by name
        episodes.sort((a, b) => a.rawName.localeCompare(b.rawName, undefined, { numeric: true, sensitivity: 'base' }));

        const finalEpisodes = episodes.map((ep, index) => ({
            href: ep.href,
            number: index + 1,
            title: ep.title
        }));

        return JSON.stringify(finalEpisodes);

    } catch (error) {
        console.error("extractEpisodes error:", error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        // url is the file path e.g. /Anime/Naruto/ep1.mp4
        // Direct resolving via /api/raw
        const streamUrl = `${BASE_URL}/api/raw?path=${encodeURIComponent(url)}`;
        
        // We assume the raw endpoint redirects to the actual file or proxies it.
        // Sora supports this directly usually.
        
        const result = {
            streams: [{
                title: "OneDrive Direct",
                streamUrl: streamUrl,
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; Sora/1.0)",
                    // Sometimes explicit referer helps with Vercel/OneDrive
                    "Referer": BASE_URL 
                }
            }],
            subtitles: [] // No subtitle parsing logic requested/possible without more metadata
        };

        return JSON.stringify(result);
    } catch (error) {
        console.error("extractStreamUrl error:", error);
        return JSON.stringify({ streams: [], subtitles: [] });
    }
}
