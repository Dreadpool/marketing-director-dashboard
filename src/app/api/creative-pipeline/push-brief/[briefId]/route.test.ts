import { describe, expect, it } from 'vitest';

import { POST } from './route';

describe('POST /api/creative-pipeline/push-brief/[briefId]', () => {
  it('denies anonymous Meta publishing', async () => {
    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Meta publishing is disabled until dashboard authentication is added.',
    });
  });
});
