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

### 2. Cache fonts and immutable CSS and JS

Purpose:

- allow long-lived caching for hashed build assets and self-hosted fonts

Conditions:

- `Request URL` matches `/_app/immutable/*`
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
- deploying a new build after stale-cache issues

## GitHub Actions Deployment

Deployment is handled by the GitHub Actions workflow at [`.github/workflows/ci.yml`](/Users/carlsson/Desktop/GitHub/Plaintext.gg/.github/workflows/ci.yml).

On pushes to `main`, the workflow:

1. runs verification
2. builds the static site
3. deploys the `build/` directory to Bunny Storage

The deploy step runs [`scripts/deploy-bunny-storage.mjs`](/Users/carlsson/Desktop/GitHub/Plaintext.gg/scripts/deploy-bunny-storage.mjs).

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

1. uploads the local `build/` output
2. deletes stale remote files that are no longer present locally
3. purges the Bunny pull zone cache

Relevant environment defaults in the script:

- source directory: `build`
- storage prefix: empty unless `BUNNY_STORAGE_PREFIX` is set

The deploy script also skips the `.wiki` directory if it is ever inside the configured source tree.

## Notes

- This project is currently using Bunny CDN in front of Bunny Storage.
- HTML is intended to be non-cacheable.
- Immutable SvelteKit assets under `/_app/immutable/` are intended to be cached aggressively.
- Fonts under `/fonts/` are intended to be cached aggressively.
- Top-level PNG and SVG assets currently use a shorter cache rule for flexibility.
