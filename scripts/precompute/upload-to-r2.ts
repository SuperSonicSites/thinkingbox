/**
 * Upload pre-computed data files to Cloudflare R2.
 *
 * Reads all files from data/precomputed/ and uploads to the DATA_BUCKET R2 bucket.
 * Uses the S3-compatible API via Wrangler or @aws-sdk/client-s3.
 *
 * Run locally:
 *   npx tsx scripts/precompute/upload-to-r2.ts
 *
 * Required env vars:
 *   R2_ACCOUNT_ID — Cloudflare account ID
 *   R2_ACCESS_KEY_ID — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME — Target bucket name (default: isp-data-canada)
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DATA_DIR = path.resolve(__dirname, "../../data/precomputed");
const BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "isp-data-canada";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";

async function uploadFile(
  key: string,
  body: Buffer,
  endpoint: string
): Promise<void> {
  // Use S3-compatible PUT via fetch
  const url = `${endpoint}/${BUCKET_NAME}/${key}`;
  const now = new Date();

  // Simple S3v4-compatible upload using Wrangler's r2 object put
  // For production, use @aws-sdk/client-s3 with R2 endpoint
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
      "x-amz-date": now.toISOString().replace(/[:-]|\.\d{3}/g, ""),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload failed for ${key}: ${response.status} ${response.statusText}`);
  }
}

async function main(): Promise<void> {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
    console.log("R2 credentials not set. Using wrangler CLI fallback.");
    console.log("Run: npx wrangler r2 object put <bucket>/<key> --file=<path>");
    console.log("");
    console.log("Listing files that would be uploaded:");
    await listFiles();
    return;
  }

  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

  console.log(`Uploading to R2 bucket: ${BUCKET_NAME}`);
  console.log(`Endpoint: ${endpoint}`);

  await uploadDirectory(path.join(DATA_DIR, "cells"), "cells", endpoint);
  await uploadDirectory(path.join(DATA_DIR, "isps"), "isps", endpoint);

  // Upload plans.json
  const plansPath = path.join(DATA_DIR, "plans.json");
  if (fs.existsSync(plansPath)) {
    const body = fs.readFileSync(plansPath);
    await uploadFile("plans.json", body, endpoint);
    console.log("Uploaded plans.json");
  }

  console.log("Upload complete.");
}

async function uploadDirectory(
  dirPath: string,
  prefix: string,
  endpoint: string
): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    console.log(`Skipping ${prefix}/ — directory not found`);
    return;
  }

  const files = fs.readdirSync(dirPath);
  console.log(`Uploading ${files.length} files from ${prefix}/...`);

  let uploaded = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const key = `${prefix}/${file}`;
    const body = fs.readFileSync(filePath);
    await uploadFile(key, body, endpoint);
    uploaded++;
    if (uploaded % 1000 === 0) {
      console.log(`  Uploaded ${uploaded}/${files.length}`);
    }
  }

  console.log(`  Uploaded ${uploaded} files to ${prefix}/`);
}

async function listFiles(): Promise<void> {
  let totalFiles = 0;
  let totalSize = 0;

  for (const subdir of ["cells", "isps"]) {
    const dirPath = path.join(DATA_DIR, subdir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      let dirSize = 0;
      for (const file of files) {
        const stat = fs.statSync(path.join(dirPath, file));
        dirSize += stat.size;
      }
      console.log(`  ${subdir}/: ${files.length} files (${(dirSize / 1024 / 1024).toFixed(1)} MB)`);
      totalFiles += files.length;
      totalSize += dirSize;
    }
  }

  const plansPath = path.join(DATA_DIR, "plans.json");
  if (fs.existsSync(plansPath)) {
    const stat = fs.statSync(plansPath);
    console.log(`  plans.json: ${(stat.size / 1024).toFixed(1)} KB`);
    totalFiles += 1;
    totalSize += stat.size;
  }

  console.log(`  Total: ${totalFiles} files (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
