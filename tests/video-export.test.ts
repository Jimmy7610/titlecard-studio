import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_FRAMES,
  MAX_SEQUENCE_BYTES,
  estimateFrameBytes,
  sequenceBudget,
} from "../lib/video/export";
import { ZipBuilder } from "../lib/video/zip";
import type { VideoExportConfig } from "../lib/types";

/**
 * The raster exports are the only part of the app that can take the tab down
 * with them. A frame cap does not bound memory — 900 frames of 4K is not 900
 * frames of 360p — so the budget is in bytes and it is checked before the job
 * starts rather than after it has eaten the session.
 */

const config = (over: Partial<VideoExportConfig>): VideoExportConfig => ({
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 4,
  transparent: false,
  loops: 1,
  ...over,
});

test("a frame estimate scales with the pixels, not the frame count", () => {
  const small = estimateFrameBytes(640, 360);
  const large = estimateFrameBytes(3840, 2160);
  assert.ok(large > small * 30, "4K is dramatically more than 360p");
  assert.ok(small > 0);
});

test("an ordinary sequence is inside the budget", () => {
  const budget = sequenceBudget(config({ width: 1920, height: 1080, duration: 4, fps: 30 }));
  assert.equal(budget.frames, 120);
  assert.equal(budget.withinBudget, true);
  assert.equal(budget.message, null);
});

test("a sequence that would not fit is refused with a reason", () => {
  const budget = sequenceBudget(config({ width: 3840, height: 2160, duration: 30, fps: 30 }));
  assert.equal(budget.withinBudget, false);
  assert.ok(budget.message);
  assert.match(budget.message!, /GB|MB/, "the message says how big it would be");
  assert.match(budget.message!, /fewer frames|smaller|video format/i, "it says what to do");
});

test("the frame cap still applies inside the budget", () => {
  const budget = sequenceBudget(config({ width: 320, height: 180, duration: 600, fps: 60 }));
  assert.equal(budget.frames, MAX_FRAMES);
});

test("the budget is a real limit, not a formality", () => {
  assert.ok(MAX_SEQUENCE_BYTES > 100 * 1024 * 1024, "big enough for a real export");
  assert.ok(MAX_SEQUENCE_BYTES < 4 * 1024 * 1024 * 1024, "small enough to actually deliver");
});

/* ------------------------------------------------------------------ *
 * Archive
 * ------------------------------------------------------------------ */

const bytes = (...values: number[]) => new Uint8Array(values);

test("an archive is assembled incrementally and reports its size", async () => {
  const archive = new ZipBuilder();
  assert.equal(archive.count, 0);
  assert.equal(archive.bytes, 0);

  await archive.add("a.png", new Blob([bytes(1, 2, 3)]));
  const afterOne = archive.bytes;
  assert.equal(archive.count, 1);
  assert.ok(afterOne > 3, "headers count towards the running total");

  await archive.add("b.png", new Blob([bytes(4, 5)]));
  assert.equal(archive.count, 2);
  assert.ok(archive.bytes > afterOne);
});

test("the archive is a readable zip", async () => {
  const archive = new ZipBuilder();
  await archive.add("frames/one.png", new Blob([bytes(0x89, 0x50, 0x4e, 0x47)]));
  await archive.add("frames/two.png", new Blob([bytes(0x89, 0x50, 0x4e, 0x47)]));

  const blob = archive.finish();
  assert.equal(blob.type, "application/zip");

  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.getUint32(0, true), 0x04034b50, "starts with a local file header");

  // The end-of-central-directory record is the last 22 bytes and names the
  // entry count; a reader that cannot find it treats the file as corrupt.
  const end = view.byteLength - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 8, true), 2, "two entries");
  assert.equal(view.getUint16(end + 10, true), 2);
});

test("an empty archive is still a valid zip", async () => {
  const blob = new ZipBuilder().finish();
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.byteLength, 22);
  assert.equal(view.getUint32(0, true), 0x06054b50);
});

test("entry names survive as written", async () => {
  const archive = new ZipBuilder();
  await archive.add("räksmörgås/frame-0001.png", new Blob([bytes(1)]));
  const text = await archive.finish().text();
  // Written as UTF-8 bytes, so the name comes back out of the header intact.
  assert.ok(text.includes("frame-0001.png"));
});
