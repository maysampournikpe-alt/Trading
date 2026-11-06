// Tiny JSON store on Vercel Blob. Set BLOB_ACCESS=public only if your Blob store is public (private is the default and the safe choice).
const mem = new Map(); // used only when STORE_MEMORY=1 (tests)
const ACCESS = process.env.BLOB_ACCESS === "public" ? "public" : "private";
const memory = () => process.env.STORE_MEMORY === "1";
function wrap(e) {
  if (/BLOB_READ_WRITE_TOKEN|No token found/i.test(e.message || "")) {
    return Object.assign(new Error("Storage is not set up: connect a Blob store to this Vercel project"), { status: 503 });
  }
  if (/already exists/i.test(e.message || "")) return Object.assign(new Error("exists"), { code: "EXISTS" });
  return e;
}
async function readJson(path) {
  if (memory()) return mem.has(path) ? JSON.parse(mem.get(path)) : null;
  try {
    const { get } = require("@vercel/blob");
    const r = await get(path, { access: ACCESS, useCache: false });
    if (!r) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) { throw wrap(e); }
}
async function writeJson(path, obj, { overwrite = true } = {}) {
  const body = JSON.stringify(obj);
  if (memory()) {
    if (!overwrite && mem.has(path)) throw Object.assign(new Error("exists"), { code: "EXISTS" });
    mem.set(path, body); return;
  }
  try {
    const { put } = require("@vercel/blob");
    await put(path, body, { access: ACCESS, contentType: "application/json", addRandomSuffix: false, allowOverwrite: overwrite });
  } catch (e) { throw wrap(e); }
}
module.exports = { readJson, writeJson };
