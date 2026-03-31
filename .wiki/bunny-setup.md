# Bunny Setup

This document describes the current Bunny.net setup for `plaintext.gg`.

It is based on the current dashboard configuration and the deploy workflow in this repo.

## Overview

- Site: `https://plaintext.gg`
- Pull zone name: `plaintext`
- Pull zone ID: `5555116`
- Default Bunny hostname: `plaintext.b-cdn.net`
- Custom hostname: `plaintext.gg`

## CDN Hostnames

The CDN pull zone has these hostnames attached:

- `plaintext.b-cdn.net`
  - SSL: enabled
  - Force SSL: off
- `plaintext.gg`
  - SSL: enabled
  - Force SSL: on

## Origin

The pull zone origin is configured as a Bunny Storage Zone.

- Origin type: `Storage Zone`
- Storage zone: `plaintext`

No custom origin URL is used.

## Storage Zone

The storage zone used by the site is `plaintext`.

FTP and API access values currently visible in the dashboard:

- Username: `plaintext`
- Hostname: `storage.bunnycdn.com`
- Connection type: `Passive`
- Port: `21`

The write password and read-only password are intentionally not stored in this repo.

## Edge Rules

There are currently 3 edge rules.

### 1. Don't cache HTML

Purpose:

- prevent stale HTML from being cached
- make sure `index.html` and `/` are always fetched fresh

Conditions:

- `Request URL` matches `/`
- `Request URL` matches `/index.html`

Actions:

- `Browser Cache Header (Cache-Control) Override` -> `Cache-Control: no-store`
- `Origin Override Cache Time` -> `0 seconds`

### 2. Cache fonts and static CSS and JS

Purpose:

- allow long-lived caching for CSS, JS, and self-hosted fonts
- these files change only on deploy and the CDN cache is purged after each deploy

Conditions:

- `Request URL` matches `/*.css`
- `Request URL` matches `/*.js`
- `Request URL` matches `/fonts/*`

Actions:

- `Browser Cache Header (Cache-Control) Override` -> `Cache-Control: public, max-age=31536000, immutable`

### 3. Shorter cache for images and manifest

Purpose:

- allow caching for top-level image and manifest assets without pinning them for a full year

Conditions:

- `Request URL` matches `/favicon.ico`
- `Request URL` matches `/manifest.webmanifest`
- `Request URL` matches `/*.svg`
- `Request URL` matches `/*.png`

Actions:

- `Browser Cache Header (Cache-Control) Override` -> `Cache-Control: public, max-age=3600`

## Cache Management

When changing edge rules or deploying important frontend updates, use Bunny's `Purge Cache` action in the dashboard to clear any previously cached edge content.

This is especially important after:

- changing HTML cache behavior
- changing asset cache rules
- deploying updates after stale-cache issues

## GitHub Actions Deployment

Deployment is handled by the GitHub Actions workflow at `.github/workflows/ci.yml`.

On pushes to `main`, the workflow:

1. runs unit tests
2. deploys the `public/` directory to Bunny Storage (no build step)

The deploy step runs `scripts/deploy-bunny-storage.mjs`.

Workflow concurrency behavior:

- pull request runs can cancel older runs on the same PR
- push runs on `main` queue instead of canceling an in-flight production deploy

### Required GitHub Actions Secrets

- `BUNNY_API_KEY`
- `BUNNY_PULL_ZONE_ID`
- `BUNNY_STORAGE_ENDPOINT`
- `BUNNY_STORAGE_PASSWORD`
- `BUNNY_STORAGE_ZONE`

Expected values for this setup:

- `BUNNY_PULL_ZONE_ID=5555116`
- `BUNNY_STORAGE_ZONE=plaintext`
- `BUNNY_STORAGE_ENDPOINT=storage.bunnycdn.com`

Do not commit the API key or storage password.

## Current Deploy Script Behavior

The current deploy script does the following:

1. uploads the `public/` directory directly (no build step needed)
2. deletes stale remote files that are no longer present locally
3. purges the Bunny pull zone cache

Relevant environment defaults in the script:

- source directory: `public`
- storage prefix: empty unless `BUNNY_STORAGE_PREFIX` is set

## Notes

- This project is a vanilla HTML/CSS/JS site with no build step.
- HTML is intended to be non-cacheable.
- CSS and JS files (`app.css`, `app.js`, `shared.js`, `sw.js`) are cached aggressively; the CDN cache is purged on every deploy.
- Fonts under `/fonts/` are intended to be cached aggressively.
- Top-level PNG and SVG assets currently use a shorter cache rule for flexibility.
