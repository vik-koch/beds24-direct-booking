import { createServer, type IncomingMessage } from 'node:http';
import { bookings, type Booking, type Held } from './bookings.ts';
import { roomCalendars } from './calendar.ts';
import { roomOffers } from './offers.ts';
import { propertyList } from './properties.ts';
import { checkoutPath, stripe, type Answer } from './stripe.ts';

const refreshToken = 'simulator';

const routes: Record<
  string,
  {
    type: string;
    cost: number;
    needs?: string;
    data: (query: URLSearchParams, held: Held) => unknown[] | null;
  }
> = {
  '/v2/properties': { type: 'property', cost: 1.6, data: propertyList },
  '/v2/inventory/rooms/calendar': {
    type: 'calendar',
    cost: 1,
    needs: 'startDate and endDate',
    data: roomCalendars,
  },
  '/v2/inventory/rooms/offers': {
    type: 'offer',
    cost: 1,
    needs: 'arrival and departure',
    data: roomOffers,
  },
};

// Decoded once, so a character split between chunks stays whole.
const body = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

// `publicUrl` is where a browser reaches the simulator's checkout page.
export const sim = (publicUrl = 'http://localhost:4300') => {
  let remaining = 100;
  let resets = 0;
  // Each access token with the time it expires.
  const tokens = new Map<string, number>();
  const book = bookings();
  const payments = stripe(publicUrl);
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
    const method = request.method ?? 'GET';
    const answer = async (handle: (text: string) => Answer) => {
      const {
        status,
        body: content,
        location,
      } = handle(method === 'POST' ? await body(request) : url.search.slice(1));
      const html = typeof content === 'string';
      response
        .writeHead(status, {
          ...(location && { Location: location }),
          ...(content && {
            'Content-Type': html ? 'text/html; charset=utf-8' : 'application/json',
          }),
        })
        .end(html ? content : content && JSON.stringify(content));
    };
    if (url.pathname.startsWith('/v1/'))
      return answer((text) =>
        payments.api(method, url.pathname, request.headers.authorization, text),
      );
    if (url.pathname.startsWith(checkoutPath))
      return answer((text) =>
        payments.checkout(method, url.pathname.slice(checkoutPath.length), text),
      );
    if (url.pathname === '/v2/authentication/token') {
      if (request.headers['refreshtoken'] !== refreshToken) return fail(401, 'Token not valid');
      const token = `access-${crypto.randomUUID()}`;
      tokens.set(token, Date.now() + 86_400_000);
      return send(200, { token, expiresIn: 86_400 }, 0.5);
    }
    const expires = tokens.get(String(request.headers['token']));
    if (!expires || expires <= Date.now()) return fail(401, 'Token not valid');
    if (url.pathname === '/v2/bookings' && request.method === 'POST') {
      const items = await body(request)
        .then((text) => JSON.parse(text) as Booking[])
        .catch(() => null);
      if (!Array.isArray(items)) return fail(400, 'A list of bookings is required');
      return send(201, book.post(items), 1.1);
    }
    const route = routes[url.pathname];
    if (!route || request.method !== 'GET') return fail(404, 'Not found');
    const data = route.data(url.searchParams, book.held);
    if (!data) return fail(400, `${route.needs} are required`);
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
  sim(process.env['SIM_PUBLIC_URL'] ?? `http://localhost:${port}`).listen(port, () =>
    console.log(`Beds24 and Stripe simulator on port ${port}`),
  );
}
