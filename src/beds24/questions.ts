// What a property's booking form asks, from its settings in Beds24 (ADR 19).

export const guestFields = [
  'title',
  'firstName',
  'lastName',
  'email',
  'phone',
  'mobile',
  'fax',
  'company',
  'address',
  'city',
  'state',
  'postcode',
  'countryText',
  'countrySelect',
  'arrivalTime',
  'comments',
] as const;
export type GuestField = (typeof guestFields)[number];

const customTypes = [
  'singleLineField',
  'multiLineField',
  'multipleSelect',
  'multipleList',
  'tickBox',
  'dateSelector',
] as const;
export type CustomType = (typeof customTypes)[number];

// Its label and choices per Beds24 language code; a choice is answered by its position.
export interface CustomQuestion {
  key: `custom${number}`;
  required: boolean;
  type: CustomType;
  label: Record<string, string>;
  choices?: Record<string, string[]>;
}
export type Question = { key: GuestField; required: boolean } | CustomQuestion;

interface Deposit {
  fixedAmount: number | null;
  variableAmount: { type: string; percentageValue: number | null } | null;
}

export interface BookingSetup {
  id: number;
  texts?: ({ language: string } & Record<`customQuestion${number}`, string>)[];
  bookingQuestions: Record<string, { usage: string; order: number | null; type?: string }>;
  bookingRules: {
    bookingType: string;
    bookingNearType: string | null;
    bookingNearTypeDays: number | null;
    bookingExceptionalType: string | null;
    bookingExceptionalTypeEnd: string | null;
  };
  paymentCollection: { depositPayment1: Deposit; depositPayment2: Deposit };
}

// Stripe and Beds24's confirmation need them, so the form asks them where Beds24 does not.
const always: GuestField[] = ['firstName', 'lastName', 'email'];
const full = 'confirmedWithDepositCollection1';
const share = ({ fixedAmount, variableAmount }: Deposit) =>
  fixedAmount ? NaN : (variableAmount?.percentageValue ?? 0);

// The site takes the whole price when the guest books; Beds24 must ask the same, also near the
// arrival and in an exceptional period that has not passed.
const paidInFull = ({ bookingRules: rules, paymentCollection }: BookingSetup, today: string) =>
  rules.bookingType === full &&
  share(paymentCollection.depositPayment1) === 100 &&
  share(paymentCollection.depositPayment2) === 0 &&
  (rules.bookingNearType === null ||
    rules.bookingNearTypeDays === null ||
    rules.bookingNearType === full) &&
  (rules.bookingExceptionalType === null ||
    (rules.bookingExceptionalTypeEnd ?? '') < today ||
    rules.bookingExceptionalType === full);

const required = (usage: string) => usage === 'compulsory' || usage === 'compulsoryBookingPage';

// A custom question's text in each language, "Arriving by [Car][Train]" for a choice; a reason
// where it cannot be asked.
function custom(key: string, type: string, property: BookingSetup, languages: string[]) {
  if (!customTypes.includes(type as CustomType)) return `its type ${type} is unknown`;
  const choice = type === 'multipleSelect' || type === 'multipleList';
  const label: Record<string, string> = {};
  const choices: Record<string, string[]> = {};
  for (const language of languages) {
    const text =
      property.texts?.find((one) => one.language === language)?.[
        key as `customQuestion${number}`
      ] ?? '';
    const parts = choice ? /^(.*?)((?:\s*\[[^\]]*\])+)\s*$/s.exec(text) : null;
    const [question, options] = parts ? [parts[1], parts[2]] : [text, ''];
    label[language] = question.trim();
    choices[language] = [...options.matchAll(/\[([^\]]*)\]/g)].map(([, one]) => one.trim());
    if (!label[language]) return `it has no text in ${language}`;
    if (choice && (!choices[language].length || choices[language].includes('')))
      return `it has no choices in ${language}`;
  }
  return { type: type as CustomType, label, ...(choice && { choices }) };
}

// Its questions in Beds24's order, or null where the property takes no booking on the site: its
// booking rules differ from the site's, or a question it must ask cannot be. Logged each time.
export function readQuestions(
  property: BookingSetup,
  languages: string[],
  today: string,
): Question[] | null {
  const owner = `Property ${property.id}`;
  if (!paidInFull(property, today)) {
    console.error(
      `${owner}: Beds24's booking rules ask for other than the full price: booking closed`,
    );
    return null;
  }
  let closed = false;
  const asked = Object.entries(property.bookingQuestions)
    .filter(([, { usage }]) => usage === 'optional' || required(usage))
    .sort(([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity))
    .flatMap(([name, { usage, type = '' }]): Question[] => {
      const field = name.replace(/^guest(.)/, (_, first: string) => first.toLowerCase());
      if (guestFields.includes(field as GuestField))
        return [
          {
            key: field as GuestField,
            required: required(usage) || always.includes(field as GuestField),
          },
        ];
      const number = /^customQuestion(\d+)$/.exec(name)?.[1];
      const question = number ? custom(name, type, property, languages) : 'it is unknown';
      if (typeof question === 'object')
        return [{ key: `custom${Number(number)}`, required: required(usage), ...question }];
      closed ||= required(usage);
      const what = `${owner}: the question ${name} is not supported, as ${question}`;
      if (required(usage)) console.error(`${what}: booking closed`);
      else console.warn(`${what}: left out`);
      return [];
    });
  if (closed) return null;
  const missing = always.filter((key) => !asked.some((question) => question.key === key));
  return [...missing.map((key) => ({ key, required: true })), ...asked];
}
