module.exports = async function handler(request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const sharedCode = process.env.BELLDESK_SHARED_CODE;

  if (!supabaseUrl || !supabaseSecretKey || !sharedCode) {
    return response.status(503).json({ error: 'BellDesk ยังตั้งค่า Supabase หรือรหัสหัวหน้าไม่ครบใน Vercel' });
  }

  const isManager = request.headers['x-belldesk-code'] === sharedCode;

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
      const { key, value, action } = request.body || {};
      if (action === 'manager-check') {
        return isManager
          ? response.status(200).json({ ok: true })
          : response.status(401).json({ error: 'รหัสหัวหน้าไม่ถูกต้อง' });
      }
      if (typeof key !== 'string' || !/^[a-z0-9_]{1,80}$/.test(key) || value === undefined) {
        return response.status(400).json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' });
      }

      if (!isManager) {
        const employeeWritableKeys = new Set([
          'belldesk_statuses_v1', 'belldesk_shifts_v1', 'belldesk_shift_log_v1',
          'belldesk_tasks_v1', 'belldesk_task_history_v1', 'belldesk_task_queue_v1',
        ]);
        if (!employeeWritableKeys.has(key)) {
          return response.status(403).json({ error: 'รายการนี้จัดการได้เฉพาะหัวหน้า' });
        }

        if (key === 'belldesk_task_queue_v1') {
          const currentResponse = await fetch(`${endpoint}?select=value&key=eq.belldesk_task_queue_v1`, { headers, cache: 'no-store' });
          if (!currentResponse.ok) {
            console.error('BellDesk task queue check failed:', currentResponse.status, await currentResponse.text());
            return response.status(502).json({ error: 'ตรวจสอบคิวงานไม่สำเร็จ' });
          }
          const currentRows = await currentResponse.json();
          const currentQueue = currentRows[0]?.value || [];
          const allowedTransitions = { assigned: ['assigned', 'accepted'], accepted: ['accepted', 'active'], active: ['active', 'done'], done: ['done'] };
          const nextQueue = value;
          if (!Array.isArray(nextQueue) || nextQueue.length !== currentQueue.length) {
            return response.status(403).json({ error: 'พนักงานแก้ไขหรือเพิ่มรายการในคิวไม่ได้' });
          }
          const validQueueUpdate = currentQueue.every((oldItem) => {
            const nextItem = nextQueue.find((item) => item.id === oldItem.id);
            return nextItem
              && ['employeeId', 'typeId', 'name', 'room', 'createdAt'].every((field) => nextItem[field] === oldItem[field])
              && (allowedTransitions[oldItem.status] || []).includes(nextItem.status);
          });
          if (!validQueueUpdate) return response.status(403).json({ error: 'แก้ไขได้เฉพาะสถานะรับงานของพนักงาน' });
        }
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
