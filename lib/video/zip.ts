/**
 * A minimal ZIP writer — stored entries only, no compression.
 *
 * A PNG sequence is the one export that produces many files, and handing the
 * user ninety separate downloads is not an export. A real compression library
 * would be a dependency carried by everyone to serve one panel, and it would
 * buy nothing: PNG is already deflated, so storing the bytes verbatim costs
 * about 0.1% over deflating them again.
 *
 * Entries are added one at a time and kept as `Blob`s, never as buffers. That
 * is the whole memory story: a Blob lives in the browser's blob store, which
 * spills to disk, while a `Uint8Array` is JS heap that cannot. Collecting nine
 * hundred 1080p frames as byte arrays before building the archive — which is
 * what this used to do — is a couple of gigabytes of heap and a dead tab. The
 * CRC is computed by streaming each blob once, so peak heap is one chunk.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc: number, bytes: Uint8Array): number {
  let next = crc;
  for (let i = 0; i < bytes.length; i += 1) {
    next = CRC_TABLE[(next ^ bytes[i]) & 0xff] ^ (next >>> 8);
  }
  return next;
}

/** Streams a blob once to checksum it, holding one chunk at a time. */
async function crc32OfBlob(blob: Blob): Promise<number> {
  let crc = 0xffffffff;

  if (typeof blob.stream === "function") {
    const reader = blob.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      crc = crc32Update(crc, value);
    }
  } else {
    // Older engines without Blob.stream still have to produce a valid archive.
    crc = crc32Update(crc, new Uint8Array(await blob.arrayBuffer()));
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS time/date. Anything in range works; a fixed stamp keeps output stable. */
const DOS_TIME = 0;
const DOS_DATE = 0x2821; // 2020-01-01

type Record = { name: Uint8Array<ArrayBuffer>; crc: number; size: number; offset: number };

/**
 * Builds an archive incrementally.
 *
 * Nothing is concatenated until `finish()`, and the parts handed to the final
 * `Blob` are themselves blobs, so the bytes never have to exist in the heap all
 * at once.
 */
export class ZipBuilder {
  private readonly encoder = new TextEncoder();
  private readonly parts: BlobPart[] = [];
  private readonly records: Record[] = [];
  private offset = 0;

  /** Bytes written so far, headers included. */
  get bytes(): number {
    return this.offset;
  }

  get count(): number {
    return this.records.length;
  }

  async add(name: string, blob: Blob): Promise<void> {
    const encoded = this.encoder.encode(name) as Uint8Array<ArrayBuffer>;
    const crc = await crc32OfBlob(blob);
    const size = blob.size;

    const local = new Uint8Array(30 + encoded.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // stored
    view.setUint16(10, DOS_TIME, true);
    view.setUint16(12, DOS_DATE, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, encoded.length, true);
    view.setUint16(28, 0, true);
    local.set(encoded, 30);

    this.parts.push(local, blob);
    this.records.push({ name: encoded, crc, size, offset: this.offset });
    this.offset += local.length + size;
  }

  finish(): Blob {
    const central: Uint8Array<ArrayBuffer>[] = [];

    for (const entry of this.records) {
      const record = new Uint8Array(46 + entry.name.length);
      const view = new DataView(record.buffer);
      view.setUint32(0, 0x02014b50, true); // central directory header
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, DOS_TIME, true);
      view.setUint16(14, DOS_DATE, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.size, true);
      view.setUint32(24, entry.size, true);
      view.setUint16(28, entry.name.length, true);
      view.setUint32(42, entry.offset, true);
      record.set(entry.name, 46);
      central.push(record);
    }

    const centralSize = central.reduce((total, record) => total + record.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true); // end of central directory
    view.setUint16(8, this.records.length, true);
    view.setUint16(10, this.records.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, this.offset, true);

    return new Blob([...this.parts, ...central, end], { type: "application/zip" });
  }
}
