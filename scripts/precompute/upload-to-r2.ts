/**
 * Upload pre-computed data files to Cloudflare R2 via S3-compatible API.
 *
 * Reads all files from data/precomputed/ and uploads to R2:
 *   - cells/{prefix2}/{geohash}.json → R2 key: cells/{geohash}.json
 *   - isps/{hexuid}.json             → R2 key: isps/{hexuid}.json
 *   - plans.json                     → R2 key: plans.json
 *
 * Required env vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME      — (optional) default: isp-data-canada
 *
 * Run:
 *   npx tsx scripts/precompute/upload-to-r2.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DATA_DIR = path.resolve(__dirname, "../../data/precomputed");
const BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "isp-data-canada";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const CONCURRENCY = 100;

interface UploadJob {
  key: string;
  localPath: string;
}

function collectCellFiles(cellsDir: string): UploadJob[] {
  const jobs: UploadJob[] = [];
  if (!fs.existsSync(cellsDir)) return jobs;

  const entries = fs.readdirSync(cellsDir);
  for (const entry of entries) {
    const entryPath = path.join(cellsDir, entry);
    const stat = fs.statSync(entryPath);

    if (stat.isDirectory()) {
      // Subdirectory bucketing: cells/{prefix2}/{geohash}.json → key: cells/{geohash}.json
      const subFiles = fs.readdirSync(entryPath);
      for (const file of subFiles) {
        if (file.endsWith(".json")) {
          jobs.push({
            key: `cells/${file}`,
            localPath: path.join(entryPath, file),
          });
        }
      }
    } else if (entry.endsWith(".json")) {
      // Flat structure fallback: cells/{geohash}.json
      jobs.push({ key: `cells/${entry}`, localPath: entryPath });
    }
  }

  return jobs;
}

function collectISPFiles(ispsDir: string): UploadJob[] {
  const jobs: UploadJob[] = [];
  if (!fs.existsSync(ispsDir)) return jobs;

  const files = fs.readdirSync(ispsDir);
  for (const file of files) {
    if (file.endsWith(".json")) {
      jobs.push({
        key: `isps/${file}`,
        localPath: path.join(ispsDir, file),
      });
    }
  }

  return jobs;
}

async function main(): Promise<void> {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
    console.error("Missing R2 credentials. Set these env vars:");
    console.error("  R2_ACCOUNT_ID       — Your Cloudflare account ID");
    console.error("  R2_ACCESS_KEY_ID    — R2 API token access key");
    console.error("  R2_SECRET_ACCESS_KEY — R2 API token secret key");
    console.error("");
    console.error("Create R2 API tokens at: Cloudflare Dashboard > R2 > Manage R2 API Tokens");
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    console.error("Run generate scripts first to populate data/precomputed/");
    process.exit(1);
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
  });

  console.log(`Uploading to R2 bucket: ${BUCKET_NAME}`);
  console.log(`Endpoint: https://${ACCOUNT_ID}.r2.cloudflarestorage.com`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Source: ${DATA_DIR}`);
  console.log("");

  // Collect all files
  const jobs: UploadJob[] = [];

  console.log("Collecting cell files...");
  const cellJobs = collectCellFiles(path.join(DATA_DIR, "cells"));
  jobs.push(...cellJobs);
  console.log(`  Found ${cellJobs.length} cell files`);

  console.log("Collecting ISP files...");
  const ispJobs = collectISPFiles(path.join(DATA_DIR, "isps"));
  jobs.push(...ispJobs);
  console.log(`  Found ${ispJobs.length} ISP files`);

  const plansPath = path.join(DATA_DIR, "plans.json");
  if (fs.existsSync(plansPath)) {
    jobs.push({ key: "plans.json", localPath: plansPath });
    console.log("  Found plans.json");
  }

  if (jobs.length === 0) {
    console.log("No files found to upload.");
    return;
  }

  console.log(`\nTotal: ${jobs.length} files to upload.\n`);

  // Upload with concurrency
  let succeeded = 0;
  let failed = 0;
  let nextIndex = 0;
  const startTime = Date.now();

  async function worker(): Promise<void> {
    while (nextIndex < jobs.length) {
      const idx = nextIndex++;
      const job = jobs[idx];

      try {
        const body = fs.readFileSync(job.localPath);
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: job.key,
            Body: body,
            ContentType: "application/json",
          })
        );
        succeeded++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Error uploading ${job.key}: ${msg}`);
      }

      const completed = succeeded + failed;
      if (completed % 5000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (completed / Number(elapsed)).toFixed(0);
        console.log(
          `  Progress: ${completed}/${jobs.length} (${succeeded} ok, ${failed} failed) — ${rate} files/s — ${elapsed}s elapsed`
        );
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(CONCURRENCY, jobs.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`Upload complete in ${elapsed}s.`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
