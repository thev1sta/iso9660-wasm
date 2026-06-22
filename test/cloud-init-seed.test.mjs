// End-to-end test: drive the built wasm bundle exactly as a consumer would to
// produce a cloud-init "NoCloud" seed.iso, then parse the resulting image and
// assert it is a well-formed ISO 9660 volume carrying the expected datasource
// files. Runs against dist/ (the published artifact), not the TypeScript source.
//
// A NoCloud seed is an ISO labelled `cidata` containing at least `meta-data`
// and `user-data` in the root directory. cloud-init locates the volume by its
// label and reads those files. The Linux isofs driver strips the `;1` version
// suffix and lowercases names, so the level-1 identifiers this writer emits
// (e.g. `meta-data;1`) resolve to the names cloud-init expects.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ISOWriter } from "../dist/index.js";

const SECTOR = 2048;
const wasmPath = fileURLToPath(
	new URL("../dist/iso9660.wasm", import.meta.url),
);

const META_DATA = [
	"instance-id: iid-local01",
	"local-hostname: cloudimg",
	"",
].join("\n");

const USER_DATA = [
	"#cloud-config",
	"users:",
	"  - name: ubuntu",
	"    sudo: ALL=(ALL) NOPASSWD:ALL",
	"package_update: true",
	"",
].join("\n");

const latin1 = new TextDecoder("latin1");

/** Reads a little-endian uint32 (the "L" half of an ECMA-119 both-endian field). */
function leU32(bytes, offset) {
	return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(
		0,
		true,
	);
}

/**
 * Walks an ISO 9660 directory extent and returns its records. ECMA-119 §9.1:
 * each record is `len`-prefixed; a zero length means "skip to the next sector".
 */
function readDirectory(image, lba, size) {
	const start = lba * SECTOR;
	const end = start + size;
	const entries = [];

	for (let offset = start; offset < end; ) {
		const len = image[offset];
		if (len === 0) {
			// Records never span sectors; jump to the start of the next one.
			const nextSector =
				start + (Math.floor((offset - start) / SECTOR) + 1) * SECTOR;
			if (nextSector >= end) break;
			offset = nextSector;
			continue;
		}

		const extent = leU32(image, offset + 2);
		const dataLength = leU32(image, offset + 10);
		const flags = image[offset + 25];
		const idLen = image[offset + 32];
		const id = latin1.decode(image.subarray(offset + 33, offset + 33 + idLen));

		entries.push({
			id,
			extent,
			size: dataLength,
			isDir: (flags & 0x02) !== 0,
		});
		offset += len;
	}

	return entries;
}

/** Minimal reader for the bits of an ISO this test needs to verify. */
function parseIso(image) {
	const pvd = 16 * SECTOR; // primary volume descriptor sits at sector 16

	const signature = latin1.decode(image.subarray(pvd + 1, pvd + 6));
	const volumeId = latin1.decode(image.subarray(pvd + 40, pvd + 72)).trim();

	// Root directory record is embedded in the PVD at byte offset 156.
	const rootRecord = pvd + 156;
	const rootLba = leU32(image, rootRecord + 2);
	const rootSize = leU32(image, rootRecord + 10);

	const root = readDirectory(image, rootLba, rootSize);

	const readFileNamed = (name) => {
		const entry = root.find((e) => !e.isDir && e.id === name);
		if (!entry) return undefined;
		return latin1.decode(
			image.subarray(entry.extent * SECTOR, entry.extent * SECTOR + entry.size),
		);
	};

	return { signature, volumeId, root, readFileNamed };
}

describe("cloud-init NoCloud seed.iso", () => {
	let image;
	let iso;

	before(async () => {
		const wasmBinary = await readFile(wasmPath);
		const writer = await ISOWriter.create({ wasmBinary });
		writer.addFile("meta-data", new TextEncoder().encode(META_DATA));
		writer.addFile("user-data", new TextEncoder().encode(USER_DATA));
		image = await writer.write("cidata");
		writer.close();
		iso = parseIso(image);
	});

	it("produces a valid, sector-aligned ISO 9660 volume", () => {
		assert.equal(
			image.length % SECTOR,
			0,
			"image must be a whole number of sectors",
		);
		assert.ok(
			image.length >= 17 * SECTOR,
			"image must contain at least the system + descriptor area",
		);
		assert.equal(
			iso.signature,
			"CD001",
			"standard identifier in the primary volume descriptor",
		);
	});

	it("labels the volume `cidata` so cloud-init can find it", () => {
		assert.equal(iso.volumeId, "cidata");
	});

	it("places meta-data and user-data in the root directory", () => {
		const files = iso.root.filter((e) => !e.isDir).map((e) => e.id);
		// isofs strips the `;1` version; both must be present for NoCloud.
		assert.ok(
			files.includes("meta-data;1"),
			`meta-data missing, got: ${files.join(", ")}`,
		);
		assert.ok(
			files.includes("user-data;1"),
			`user-data missing, got: ${files.join(", ")}`,
		);
	});

	it("preserves the seed file contents byte-for-byte", () => {
		assert.equal(iso.readFileNamed("meta-data;1"), META_DATA);
		assert.equal(iso.readFileNamed("user-data;1"), USER_DATA);
	});

	it("does not leak unexpected files into the root", () => {
		// Only `.` (0x00), `..` (0x01) and our two files should be present.
		const realFiles = iso.root.filter(
			(e) => !e.isDir && e.id.charCodeAt(0) > 1,
		);
		assert.equal(realFiles.length, 2);
	});
});
