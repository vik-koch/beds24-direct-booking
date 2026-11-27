import { createServer, type IncomingMessage } from 'node:http';
import { bookings, type Booking, type Held } from './bookings.ts';
import { roomCalendars } from './calendar.ts';
import { propertyList } from './properties.ts';

const refreshToken = 'simulator';

const routes: Record<
  string,
  { type: string; cost: number; data: (query: URLSearchParams, held: Held) => unknown[] | null }
> = {
  '/v2/properties': { type: 'property', cost: 1.6, data: propertyList },
  '/v2/inventory/rooms/calendar': { type: 'calendar', cost: 1, data: roomCalendars },
};

const body = async (request: IncomingMessage) => {
  let text = '';
  for await (const chunk of request) text += chunk;
  return JSON.parse(text) as Booking[];
};

export const sim = () => {
  let remaining = 100;
  let resets = 0;
  const tokens = new Set<string>();
  const book = bookings();
  const server = createServer(async (request, response) => {
    if (Date.now() >= resets) {
      remaining = 100;
      resets = Date.now() + 300_000;
    }
    const send = (status: number, answer: object, cost?: number) => {
      if (cost) remaining = Math.round((remaining - cost) * 10) / 10;
      response
        .writeHead(status, {
          'Content-Type': 'application/json',
          ...(cost && {
            'X-Request-Cost': cost,
            'X-Five-Min-Limit-Remaining': remaining,
            'X-Five-Min-Limit-Resets-In': Math.ceil((resets - Date.now()) / 1000),
          }),
        })
        .end(JSON.stringify(answer));
    };
    const fail = (code: number, error: string) =>
      send(code, { success: false, type: 'error', code, error });

    const url = new URL(request.url ?? '', 'http://sim');
    if (url.pathname === '/v2/authentication/token') {
      if (request.headers['refreshtoken'] !== refreshToken) return fail(401, 'Token not valid');
      const token = `access-${crypto.randomUUID()}`;
      tokens.add(token);
      return send(200, { token, expiresIn: 86_400 }, 0.5);
    }
    if (!tokens.has(String(request.headers['token']))) return fail(401, 'Token not valid');
    if (url.pathname === '/v2/bookings' && request.method === 'POST')
      return send(201, book.post(await body(request)), 1.1);
    const route = routes[url.pathname];
    if (!route || request.method !== 'GET') return fail(404, 'Not found');
    const data = route.data(url.searchParams, book.held);
    if (!data) return fail(400, 'startDate and endDate are required');
    return send(
      200,
      {
        success: true,
        type: route.type,
        count: data.length,
        pages: { nextPageExists: false, nextPageLink: null },
        data,
      },
      route.cost,
    );
  });
  return Object.assign(server, { bookings: book.saved });
};

if (import.meta.main) {
  const port = Number(process.env['PORT'] ?? 4300);
  sim().listen(port, () => console.log(`Beds24 simulator on port ${port}`));
}
