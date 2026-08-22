/**
 * A minimal ZIP writer — stored entries only, no compression.
 *
 * A PNG sequence is the one export that produces many files, and handing the
 * user ninety separate downloads is not an export. A real compression library
 * would be a dependency carried by everyone to serve one panel, and it would
 * buy nothing: PNG is already deflated, so storing the bytes verbatim costs
 * about 0.1% over deflating them again.
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

function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; bytes: Uint8Array<ArrayBuffer> };

/** DOS time/date. Anything in range works; a fixed stamp keeps output stable. */
const DOS_TIME = 0;
const DOS_DATE = 0x2821; // 2020-01-01

export function createZip(entries: readonly ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name) as Uint8Array<ArrayBuffer>;
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // local file header
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, 0, true); // flags
    localView.setUint16(8, 0, true); // stored
    localView.setUint16(10, DOS_TIME, true);
    localView.setUint16(12, DOS_DATE, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);

    chunks.push(local, entry.bytes);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true); // central directory header
    recordView.setUint16(4, 20, true);
    recordView.setUint16(6, 20, true);
    recordView.setUint16(8, 0, true);
    recordView.setUint16(10, 0, true);
    recordView.setUint16(12, DOS_TIME, true);
    recordView.setUint16(14, DOS_DATE, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, size, true);
    recordView.setUint32(24, size, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);

    offset += local.length + size;
  }

  const centralSize = central.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); // end of central directory
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}
