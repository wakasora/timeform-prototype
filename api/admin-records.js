const TABLE = "timeform_records";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function assertAdmin(req) {
  const expected = process.env.ADMIN_PASSCODE;
  const actual = req.headers["x-admin-passcode"];
  return Boolean(expected && actual && actual === expected);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || response.statusText;
    throw new Error(message);
  }

  return data;
}

function toDbPatch(patch = {}) {
  const next = { updated_at: new Date().toISOString() };

  if (Object.prototype.hasOwnProperty.call(patch, "targetDate")) next.target_date = patch.targetDate;
  if (Object.prototype.hasOwnProperty.call(patch, "segments")) next.segments = patch.segments;
  if (Object.prototype.hasOwnProperty.call(patch, "tags")) next.tags = patch.tags;
  if (Object.prototype.hasOwnProperty.call(patch, "isPublic")) next.is_public = patch.isPublic;
  if (Object.prototype.hasOwnProperty.call(patch, "thumb")) next.thumb = patch.thumb || "";
  if (Object.prototype.hasOwnProperty.call(patch, "deleted")) next.deleted = patch.deleted === true;

  return next;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!assertAdmin(req)) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const records = await supabaseRequest(`${TABLE}?select=*&deleted=eq.false&order=created_at.desc`);
      return json(res, 200, { records });
    }

    if (req.method === "PATCH") {
      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: "Missing id" });

      const rows = await supabaseRequest(`${TABLE}?id=eq.${encodeURIComponent(body.id)}`, {
        method: "PATCH",
        body: JSON.stringify(toDbPatch(body.patch || {}))
      });

      return json(res, 200, { record: rows?.[0] || null });
    }

    if (req.method === "DELETE") {
      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: "Missing id" });

      const rows = await supabaseRequest(`${TABLE}?id=eq.${encodeURIComponent(body.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ deleted: true, updated_at: new Date().toISOString() })
      });

      return json(res, 200, { record: rows?.[0] || null });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Server error" });
  }
};
