module.exports = async function handler(request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const sharedCode = process.env.BELLDESK_SHARED_CODE;

  if (!supabaseUrl || !supabaseSecretKey || !sharedCode) {
    return response.status(503).json({ error: 'BellDesk ยังตั้งค่า Supabase หรือรหัสร่วมไม่ครบใน Vercel' });
  }

  if (request.headers['x-belldesk-code'] !== sharedCode) {
    return response.status(401).json({ error: 'รหัสเข้าใช้งานไม่ถูกต้อง' });
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/belldesk_state`;
  const headers = {
    apikey: supabaseSecretKey,
    'Content-Type': 'application/json',
  };

  try {
    if (request.method === 'GET') {
      const result = await fetch(`${endpoint}?select=key,value`, { headers, cache: 'no-store' });
      if (!result.ok) {
        const detail = await result.text();
        console.error('BellDesk Supabase read failed:', result.status, detail);
        return response.status(502).json({ error: 'อ่านข้อมูลจาก Supabase ไม่สำเร็จ', upstreamStatus: result.status, detail });
      }
      const rows = await result.json();
      const state = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      return response.status(200).json({ state });
    }

    if (request.method === 'POST') {
      const { key, value } = request.body || {};
      if (typeof key !== 'string' || !/^[a-z0-9_]{1,80}$/.test(key) || value === undefined) {
        return response.status(400).json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' });
      }
      const result = await fetch(`${endpoint}?on_conflict=key`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      if (!result.ok) {
        const detail = await result.text();
        console.error('BellDesk Supabase write failed:', result.status, detail);
        return response.status(502).json({ error: 'บันทึกข้อมูลไป Supabase ไม่สำเร็จ', upstreamStatus: result.status, detail });
      }
      return response.status(200).json({ ok: true });
    }

    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('BellDesk Supabase request error:', error);
    return response.status(502).json({ error: 'เชื่อมต่อ Supabase ไม่สำเร็จ', detail: error.message });
  }
}
