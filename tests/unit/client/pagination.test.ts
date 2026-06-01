import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import { paginateAll, HARD_CAP } from '../../../src/client/pagination.js';

const mockReq = vi.mocked(zepRequest);
beforeEach(() => mockReq.mockReset());

describe('paginateAll', () => {
  it('walks pages until last_page and flattens', async () => {
    mockReq
      .mockResolvedValueOnce({ data: [1, 2], meta: { last_page: 2 } })
      .mockResolvedValueOnce({ data: [3], meta: { last_page: 2 } });
    const result = await paginateAll<number>({ path: '/x', maxItems: 100 });
    expect(result).toEqual([1, 2, 3]);
    expect(mockReq).toHaveBeenCalledTimes(2);
  });

  it('respects maxItems', async () => {
    mockReq.mockResolvedValue({ data: [1, 2, 3, 4, 5], meta: { last_page: 99 } });
    const result = await paginateAll<number>({ path: '/x', maxItems: 3 });
    expect(result).toHaveLength(3);
  });

  it('stops on an empty batch', async () => {
    mockReq.mockResolvedValueOnce({ data: [], meta: {} });
    const result = await paginateAll<number>({ path: '/x', maxItems: 100 });
    expect(result).toEqual([]);
    expect(mockReq).toHaveBeenCalledTimes(1);
  });

  it('never exceeds the hard cap', async () => {
    mockReq.mockResolvedValue({ data: Array.from({ length: 100 }, (_, i) => i), meta: { last_page: 999 } });
    const result = await paginateAll<number>({ path: '/x', maxItems: 10_000 });
    expect(result.length).toBeLessThanOrEqual(HARD_CAP);
  });
});
