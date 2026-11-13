import { createServer } from 'node:http';
import { roomCalendars } from './calendar.ts';
import { propertyList } from './properties.ts';

const token = 'simulator';

const routes: Record<
  string,
  { type: string; cost: number; data: (query: URLSearchParams) => unknown[] | null }
> = {
  '/v2/properties': { type: 'property', cost: 1.6, data: propertyList },
  '/v2/inventory/rooms/calendar': { type: 'calendar', cost: 1, data: roomCalendars },
};

export const sim = () => {
  let remaining = 100;
  let resets = 0;
  return createServer((request, response) => {
    const send = (status: number, body: object, headers = {}) =>
      response
        .writeHead(status, { 'Content-Type': 'application/json', ...headers })
        .end(JSON.stringify(body));
    const fail = (code: number, error: string) =>
      send(code, { success: false, type: 'error', code, error });

    const url = new URL(request.url ?? '', 'http://sim');
    const route = routes[url.pathname];
    if (request.headers['token'] !== token) return fail(401, 'Token not valid');
    if (!route || request.method !== 'GET') return fail(404, 'Not found');
    const data = route.data(url.searchParams);
    if (!data) return fail(400, 'startDate and endDate are required');

    if (Date.now() >= resets) {
      remaining = 100;
      resets = Date.now() + 300_000;
    }
    remaining = Math.round((remaining - route.cost) * 10) / 10;
    return send(
      200,
      {
        success: true,
        type: route.type,
        count: data.length,
        pages: { nextPageExists: false, nextPageLink: null },
        data,
      },
      {
        'X-Request-Cost': route.cost,
        'X-Five-Min-Limit-Remaining': remaining,
        'X-Five-Min-Limit-Resets-In': Math.ceil((resets - Date.now()) / 1000),
      },
    );
  });
};

if (import.meta.main) sim().listen(4300, () => console.log('Beds24 simulator on port 4300'));
