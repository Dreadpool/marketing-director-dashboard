import { describe, it, expect, vi } from 'vitest';

// Mock db so the import chain resolves. The 400 paths exit before any db call,
// so the mock stays trivial.
vi.mock('@/db', () => ({
  db: {
    update: () => ({ set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }) }),
  },
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://x/api/creative-pipeline/reject-brief/2026-04-c01', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/creative-pipeline/reject-brief/[briefId]', () => {
  it('returns 400 when body is not JSON', async () => {
    const req = new Request('http://x/api/creative-pipeline/reject-brief/2026-04-c01', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    const res = await POST(req as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const res = await POST(makeReq({}) as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is under 10 chars', async () => {
    const res = await POST(makeReq({ reason: 'too short' }) as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is only whitespace', async () => {
    const res = await POST(makeReq({ reason: '              ' }) as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });
});
