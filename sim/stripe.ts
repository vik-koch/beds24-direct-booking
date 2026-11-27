import { languages, type Text } from './data.ts';

export const stripeKey = 'simulator';
export const checkoutPath = '/simulated-checkout/';

interface Fields {
  [key: string]: string | Fields;
}

interface Session {
  id: string;
  object: 'checkout.session';
  amount_total: number;
  currency: string;
  client_reference_id: string | null;
  created: number;
  expires_at: number;
  locale: string | null;
  metadata: Record<string, string>;
  mode: string;
  payment_intent: string | null;
  payment_status: 'unpaid' | 'paid';
  status: 'open' | 'complete' | 'expired';
  success_url: string;
  cancel_url: string | null;
  url: string | null;
}

export interface Answer {
  status: number;
  body?: object | string;
  location?: string;
}

// Stripe's form encoding: `line_items[0][price_data][unit_amount]=100` becomes nested objects.
export const decode = (text: string) => {
  const root: Fields = {};
  for (const [key, value] of new URLSearchParams(text)) {
    const path = key.split(/[[\]]+/).filter(Boolean);
    const node = path.slice(0, -1).reduce((at, part) => (at[part] ??= {}) as Fields, root);
    node[path.at(-1)!] = value;
  }
  return root;
};

const strings = (fields: Fields | string | undefined) =>
  Object.fromEntries(
    Object.entries(typeof fields === 'object' ? fields : {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

const invalid = (message: string, param?: string, status = 400): Answer => ({
  status,
  body: { error: { type: 'invalid_request_error', message, ...(param && { param }) } },
});

const words: Record<string, Text> = {
  title: { de: 'Simulierte Zahlung', en: 'Simulated payment' },
  notice: {
    de: 'Das ist nicht Stripe, sondern der Simulator der Demo. Es wird nichts bezahlt und keine Karte belastet.',
    en: "This is not Stripe but the demo's simulator. Nothing is paid and no card is charged.",
  },
  total: { de: 'Zu zahlen', en: 'To pay' },
  pay: { de: 'Bezahlen', en: 'Pay' },
  cancel: { de: 'Abbrechen und zurück', en: 'Cancel and go back' },
  expire: { de: 'Ablaufen lassen', en: 'Let it expire' },
  complete: { de: 'Diese Zahlung ist erledigt.', en: 'This payment is complete.' },
  expired: { de: 'Diese Zahlung ist abgelaufen.', en: 'This payment has expired.' },
  missing: { de: 'Diese Zahlung gibt es nicht.', en: 'There is no such payment.' },
};

const page = (language: keyof Text, session?: Session) => {
  const say = (word: string) => words[word][language];
  const amount =
    session &&
    new Intl.NumberFormat(language, { style: 'currency', currency: session.currency }).format(
      session.amount_total / 100,
    );
  const body = !session
    ? `<p>${say('missing')}</p>`
    : session.status !== 'open'
      ? `<p>${say(session.status)}</p>`
      : `<p class="total">${say('total')}: <strong>${amount}</strong></p>
    <form method="post">
      <button name="action" value="pay">${say('pay')} ${amount}</button>
      ${session.cancel_url ? `<button name="action" value="cancel">${say('cancel')}</button>` : ''}
      <button name="action" value="expire">${say('expire')}</button>
    </form>`;
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${say('title')}</title>
    <style>
      body { margin: 0; padding: 1rem; font: 1rem/1.5 system-ui, sans-serif; }
      body, button { color: #1a1a1a; background: #fff; }
      main { max-width: 28rem; margin: 2rem auto; }
      .notice { padding: 0.75rem 1rem; border: 2px dashed #8a4b00; background: #fff4e0; }
      form { display: grid; gap: 0.75rem; }
      button { padding: 0.75rem 1rem; font: inherit; border: 1px solid; border-radius: 0.375rem; }
      button[value='pay'] { color: #fff; background: #1a1a1a; }
      button:focus-visible { outline: 3px solid #005fcc; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${say('title')}</h1>
      <p class="notice">${say('notice')}</p>
      ${body}
    </main>
  </body>
</html>`;
};

export const stripe = (publicUrl: string) => {
  const sessions = new Map<string, Session>();
  const now = () => Math.floor(Date.now() / 1000);
  // An open session past its expiry time has expired, as Stripe reports it.
  const read = (id: string) => {
    const session = sessions.get(id);
    if (session?.status === 'open' && session.expires_at <= now()) {
      session.status = 'expired';
      session.url = null;
    }
    return session;
  };

  const create = (fields: Fields): Answer => {
    for (const param of ['mode', 'success_url', 'line_items'])
      if (!fields[param]) return invalid(`Missing required param: ${param}.`, param);
    const lines = Object.values(fields['line_items'] as Fields) as Fields[];
    const prices = lines.map((line) => strings(line['price_data']));
    if (prices.some((price) => !price['unit_amount'] || !price['currency']))
      return invalid(
        'Each line item needs price_data with unit_amount and currency.',
        'line_items',
      );
    const id = `cs_test_sim${crypto.randomUUID().replaceAll('-', '')}`;
    const created = now();
    // customer_email is guest data: the demo is public, so the session never keeps it.
    const session: Session = {
      id,
      object: 'checkout.session',
      amount_total: lines.reduce(
        (sum, line, index) =>
          sum + Number(prices[index]['unit_amount']) * Number(line['quantity'] ?? 1),
        0,
      ),
      currency: prices[0]['currency'],
      client_reference_id: (fields['client_reference_id'] as string) ?? null,
      created,
      expires_at: Number(fields['expires_at'] ?? created + 86_400),
      locale: (fields['locale'] as string) ?? null,
      metadata: strings(fields['metadata']),
      mode: fields['mode'] as string,
      payment_intent: null,
      payment_status: 'unpaid',
      status: 'open',
      success_url: fields['success_url'] as string,
      cancel_url: (fields['cancel_url'] as string) ?? null,
      url: `${publicUrl}${checkoutPath}${id}`,
    };
    sessions.set(id, session);
    return { status: 200, body: session };
  };

  // Metadata merges into the session's; an empty value removes its key.
  const update = (session: Session, fields: Fields): Answer => {
    for (const [key, value] of Object.entries(strings(fields['metadata'])))
      if (value) session.metadata[key] = value;
      else delete session.metadata[key];
    return { status: 200, body: session };
  };

  // Newest first, as Stripe lists; `created` takes gt, gte, lt and lte.
  const list = (query: Fields): Answer => {
    const created = strings(query['created']);
    const tests: Record<string, (a: number, b: number) => boolean> = {
      gt: (a, b) => a > b,
      gte: (a, b) => a >= b,
      lt: (a, b) => a < b,
      lte: (a, b) => a <= b,
    };
    let all = [...sessions.keys()]
      .reverse()
      .map((id) => read(id)!)
      .filter(
        (session) =>
          (!query['status'] || session.status === query['status']) &&
          Object.entries(created).every(([test, value]) =>
            tests[test]?.(session.created, Number(value)),
          ),
      );
    const after = query['starting_after'];
    if (after) all = all.slice(all.findIndex(({ id }) => id === after) + 1);
    const limit = Math.min(Number(query['limit'] ?? 10), 100);
    return {
      status: 200,
      body: {
        object: 'list',
        data: all.slice(0, limit),
        has_more: all.length > limit,
        url: '/v1/checkout/sessions',
      },
    };
  };

  const api = (method: string, path: string, key: string | undefined, text: string): Answer => {
    if (key !== `Bearer ${stripeKey}`) return invalid('Invalid API Key provided.', undefined, 401);
    if (path === '/v1/checkout/sessions')
      return method === 'POST' ? create(decode(text)) : list(decode(text));
    const [, id] = path.match(/^\/v1\/checkout\/sessions\/([^/]+)$/) ?? [];
    if (!id) return invalid('Unrecognized request URL.', undefined, 404);
    const session = read(id);
    if (!session) return invalid(`No such checkout.session: '${id}'`, 'id', 404);
    return method === 'POST' ? update(session, decode(text)) : { status: 200, body: session };
  };

  // The page a guest is sent to; its buttons redirect as Stripe's page does.
  const checkout = (method: string, id: string, text: string): Answer => {
    const session = read(id);
    const language = languages.find((tag) => session?.locale?.startsWith(tag)) ?? 'en';
    if (method === 'POST' && session?.status === 'open') {
      const action = new URLSearchParams(text).get('action');
      if (action === 'pay') {
        Object.assign(session, {
          status: 'complete',
          payment_status: 'paid',
          payment_intent: `pi_sim${crypto.randomUUID().replaceAll('-', '')}`,
          url: null,
        });
        return { status: 303, location: session.success_url.replace('{CHECKOUT_SESSION_ID}', id) };
      }
      if (action === 'cancel' && session.cancel_url)
        return { status: 303, location: session.cancel_url };
      if (action === 'expire') session.expires_at = now();
      return { status: 303, location: `${checkoutPath}${id}` };
    }
    return { status: session ? 200 : 404, body: page(language, session) };
  };

  return { sessions, api, checkout };
};
