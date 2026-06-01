import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZepApiError } from '../../../src/client/errors.js';

vi.mock('../../../src/client/http.js', () => ({ zepRequest: vi.fn() }));
import { zepRequest } from '../../../src/client/http.js';
import { registerMasterDataResources } from '../../../src/resources/master-data.js';
import { captureResources } from '../../helpers/capture.js';

const mockReq = vi.mocked(zepRequest);
const resources = captureResources(registerMasterDataResources);

interface ResourceText {
  type: string;
  count?: number;
  data?: unknown[];
  error?: string;
  moduleGate?: boolean;
}

const read = async (type: string, uri: string): Promise<ResourceText> => {
  const res = (await resources.get(type)!.handler(new URL(uri))) as {
    contents: { uri: string; mimeType: string; text: string }[];
  };
  return JSON.parse(res.contents[0].text) as ResourceText;
};

beforeEach(() => {
  mockReq.mockReset();
});

describe('registry', () => {
  it('registers 4 master-data resources with the expected URIs and mimeType', () => {
    expect(resources.size).toBe(4);
    const byUri = new Map([...resources.values()].map((r) => [r.uri, r]));
    for (const type of ['activities', 'categories', 'price-groups', 'absence-reasons']) {
      const r = byUri.get(`zep://master-data/${type}`);
      expect(r).toBeDefined();
      expect(r!.metadata.mimeType).toBe('application/json');
    }
  });
});

describe('happy path', () => {
  it('paginates and returns contents[0] with count + data', async () => {
    mockReq.mockResolvedValueOnce({ data: [{ id: 1, name: 'Beratung' }], meta: { last_page: 1 } });
    const body = await read('activities', 'zep://master-data/activities');
    expect(mockReq).toHaveBeenCalledWith({
      method: 'GET',
      path: '/activities',
      query: { page: 1, limit: 100 },
    });
    expect(body.type).toBe('activities');
    expect(body.count).toBe(1);
    expect(body.data).toEqual([{ id: 1, name: 'Beratung' }]);
  });
});

describe('module-gate', () => {
  it('does not throw and reports a German licence message with moduleGate:true', async () => {
    mockReq.mockRejectedValueOnce(
      new ZepApiError({
        status: 404,
        message: 'The route x could not be found.',
        isModuleGate: true,
      }),
    );
    const body = await read('categories', 'zep://master-data/categories');
    expect(body.moduleGate).toBe(true);
    expect(body.error).toMatch(/Modul\/Lizenz nicht aktiviert/);
  });
});
