import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.BUNNY_STORAGE_ENDPOINT;
const storageZone = process.env.BUNNY_STORAGE_ZONE;
const accessKey = process.env.BUNNY_STORAGE_PASSWORD;
const sourceDir = process.env.BUNNY_SOURCE_DIR ?? 'build';
const prefix = normalizeRemotePath(process.env.BUNNY_STORAGE_PREFIX ?? '');

for (const [name, value] of [
	['BUNNY_STORAGE_ENDPOINT', endpoint],
	['BUNNY_STORAGE_ZONE', storageZone],
	['BUNNY_STORAGE_PASSWORD', accessKey]
]) {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
}

const baseSegments = [storageZone, prefix].filter(Boolean);

await clearRemoteRoot();
await uploadDirectory(sourceDir);

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

async function storageRequest(method, remotePath, { isDirectory = false, headers = {}, body } = {}) {
	const response = await fetch(toRemoteUrl(remotePath, isDirectory), {
		method,
		headers: {
			AccessKey: accessKey,
			...headers
		},
		body
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${method} ${remotePath || '/'} failed with ${response.status}: ${text}`);
	}

	return response;
}

async function listDirectory(remotePath = '') {
	const response = await storageRequest('GET', remotePath, { isDirectory: true });
	return response.json();
}

async function clearRemoteRoot() {
	console.log(`Clearing Bunny Storage path "${prefix || '/'}"...`);

	const items = await listDirectory();
	for (const item of items) {
		const remotePath = joinRemotePath(item.ObjectName);
		console.log(`Deleting ${item.IsDirectory ? 'directory' : 'file'}: ${remotePath}`);
		await storageRequest('DELETE', remotePath);
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
