const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const ORG = 'folio-org';
const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const DEFAULT_BRANCH = 'snapshot';
const OUTPUT_FILE = path.join(__dirname, '..', 'web', 'apps.json');
const HEADERS = {
    'User-Agent': 'folio-dependency-graph',
    // 'Authorization': 'token <TOKEN>', // Optional: for higher rate limit
};

async function fetchJson(url) {
    const res = await fetch(url, {headers: HEADERS});
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
}

async function fetchAllRepos() {
    let page = 1;
    const repos = [];
    while (true) {
        const url = `${GITHUB_API}/orgs/${ORG}/repos?per_page=100&page=${page}`;
        const pageRepos = await fetchJson(url);
        if (pageRepos.length === 0) break;
        repos.push(...pageRepos);
        page++;
    }
    return repos;
}

async function tryFetchAppDescriptor(repo) {
    console.log('Repo: ', repo.name, `Branch: ', ${DEFAULT_BRANCH}`);
    if (repo.archived) {
        console.log(`Skipping archived repo: ${repo.name}`);
        return null;
    }

    if (!repo.name.startsWith('app-')) {
        return null;
    }

    const appFile = `${repo.name}.template.json`;
    const url = `${RAW_BASE}/${ORG}/${repo.name}/${DEFAULT_BRANCH}/${appFile}`;
    try {
        const res = await fetch(url, {headers: HEADERS});
        if (res.status === 404) {
            console.log('App descriptor not found for ', repo.name, 'url: ', url, ': ', res.status);
            return null;
        }
        if (res.ok) return await res.json();
    } catch (err) {
        console.error(`Error fetching descriptor for ${repo.name}:`, err.message);
    }

    return null;
}

async function buildAppMap() {
    const repos = await fetchAllRepos();
    const map = {};

    for (const repo of repos) {
        if (!repo.name.startsWith('app-') || repo.name === 'app-platform-full') {
            continue;
        }

        const descriptor = await tryFetchAppDescriptor(repo);
        if (!descriptor) continue;

        map[repo.name] = {
            platform: descriptor.platform || '',
            dependencies: (descriptor.dependencies || []).map(d => ({
                name: d.name,
                version: d.version || ''
            })),
            modules: (descriptor.modules || []).map(m => ({
                name: m.name,
                version: m.version || ''
            })),
            uiModules: (descriptor.uiModules || []).map(ui => ({
                name: ui.name,
                version: ui.version || ''
            }))
        };
    }

    return map;
}

async function main() {
    console.log('Fetching FOLIO app descriptors...');
    const map = await buildAppMap();

    fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true});
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2));
    console.log(`Saved app map to ${OUTPUT_FILE}`);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});