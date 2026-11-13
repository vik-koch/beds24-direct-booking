import { listApartments } from './client';

describe('listApartments', () => {
  const answer = (status: number, body: object) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    );
  beforeEach(() => {
    vi.stubEnv('BEDS24_URL', 'http://beds24.test/v2');
    vi.stubEnv('BEDS24_TOKEN', 'secret');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps every room of every property into an apartment', async () => {
    answer(200, {
      success: true,
      type: 'property',
      count: 2,
      data: [
        {
          id: 1,
          name: 'House',
          roomTypes: [
            { id: 11, propertyId: 1, name: 'One' },
            { id: 12, propertyId: 1, name: 'Two' },
          ],
        },
        { id: 2, name: 'Other', roomTypes: [{ id: 21, propertyId: 2, name: 'Three' }] },
      ],
    });
    expect(await listApartments()).toEqual([
      { id: 11, propertyId: 1, name: 'One' },
      { id: 12, propertyId: 1, name: 'Two' },
      { id: 21, propertyId: 2, name: 'Three' },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'http://beds24.test/v2/properties?includeAllRooms=true',
      expect.objectContaining({ headers: { token: 'secret' } }),
    );
  });

  it('fails when Beds24 refuses the token', async () => {
    answer(401, { success: false, type: 'error', code: 401, error: 'Token not valid' });
    await expect(listApartments()).rejects.toThrow('Beds24 answered 401');
  });
});
