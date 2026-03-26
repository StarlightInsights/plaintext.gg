import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.BUNNY_STORAGE_ENDPOINT;
const storageZone = process.env.BUNNY_STORAGE_ZONE;
const storageAccessKey = process.env.BUNNY_STORAGE_PASSWORD;
const sourceDir = process.env.BUNNY_SOURCE_DIR ?? 'build';
const prefix = normalizeRemotePath(process.env.BUNNY_STORAGE_PREFIX ?? '');
const pullZoneId = process.env.BUNNY_PULL_ZONE_ID;
const apiKey = process.env.BUNNY_API_KEY;

for (const [name, value] of [
	['BUNNY_STORAGE_ENDPOINT', endpoint],
	['BUNNY_STORAGE_ZONE', storageZone],
	['BUNNY_STORAGE_PASSWORD', storageAccessKey],
	['BUNNY_PULL_ZONE_ID', pullZoneId],
	['BUNNY_API_KEY', apiKey]
]) {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
}

const baseSegments = [storageZone, prefix].filter(Boolean);

await clearRemoteRoot();
await uploadDirectory(sourceDir);
await purgePullZoneCache();

function normalizeRemotePath(value) {
	return value.replace(/^\/+|\/+$/g, '');
}

function joinRemotePath(...parts) {
	return parts
		.map((part) => normalizeRemotePath(part))
		.filter(Boolean)
		.join('/');
}

function encodeRemotePath(remotePath) {
	return remotePath
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

function toRemoteUrl(remotePath = '', isDirectory = false) {
	const fullPath = encodeRemotePath(joinRemotePath(...baseSegments, remotePath));
	const suffix = isDirectory ? '/' : '';
	return `https://${endpoint}/${fullPath}${suffix}`;
}

async function storageRequest(
	method,
	remotePath,
	{ isDirectory = false, headers = {}, body, ignoreNotFound = false } = {}
) {
	const response = await fetch(toRemoteUrl(remotePath, isDirectory), {
		method,
		headers: {
			AccessKey: storageAccessKey,
			...headers
		},
		body
	});

	if (ignoreNotFound && response.status === 404) {
		return response;
	}

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${method} ${remotePath || '/'} failed with ${response.status}: ${text}`);
	}

	return response;
}

async function purgePullZoneCache() {
	console.log(`Purging Bunny Pull Zone cache for zone ${pullZoneId}...`);

	const response = await fetch(`https://api.bunny.net/pullzone/${encodeURIComponent(pullZoneId)}/purgeCache`, {
		method: 'POST',
		headers: {
			AccessKey: apiKey,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ CacheTag: null })
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`POST purgeCache failed with ${response.status}: ${text}`);
	}

	console.log('Bunny Pull Zone cache purged.');
}

async function listDirectory(remotePath = '') {
	const response = await storageRequest('GET', remotePath, { isDirectory: true });
	return response.json();
}

async function clearRemoteRoot() {
	console.log(`Clearing Bunny Storage path "${prefix || '/'}"...`);
	await clearRemoteDirectory();
}

async function clearRemoteDirectory(remotePath = '') {
	const items = await listDirectory(remotePath);
	for (const item of items) {
		const childPath = joinRemotePath(remotePath, item.ObjectName);

		if (item.IsDirectory) {
			console.log(`Descending into directory: ${childPath}`);
			await clearRemoteDirectory(childPath);
			continue;
		}

		console.log(`Deleting file: ${childPath}`);
		await storageRequest('DELETE', childPath, { ignoreNotFound: true });
	}
}

async function uploadDirectory(rootDir) {
	const files = await walkFiles(rootDir);

	for (const filePath of files) {
		const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
		const body = await readFile(filePath);
		const contentType = getContentType(relativePath);

		console.log(`Uploading ${relativePath}`);
		await storageRequest('PUT', relativePath, {
			headers: contentType ? { 'Content-Type': contentType } : {},
			body
		});
	}
}

async function walkFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkFiles(fullPath)));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files.sort();
}

function getContentType(filePath) {
	const extension = path.extname(filePath).toLowerCase();

	switch (extension) {
		case '.html':
			return 'text/html; charset=utf-8';
		case '.css':
			return 'text/css; charset=utf-8';
		case '.js':
			return 'text/javascript; charset=utf-8';
		case '.json':
			return 'application/json; charset=utf-8';
		case '.txt':
			return 'text/plain; charset=utf-8';
		case '.ico':
			return 'image/x-icon';
		case '.svg':
			return 'image/svg+xml';
		case '.png':
			return 'image/png';
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.webp':
			return 'image/webp';
		case '.woff2':
			return 'font/woff2';
		case '.xml':
			return 'application/xml; charset=utf-8';
		case '.map':
			return 'application/json; charset=utf-8';
		default:
			return 'application/octet-stream';
	}
}
