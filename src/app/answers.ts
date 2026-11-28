import type { GuestField, Question } from '../beds24/questions';
import type { Texts } from '../content/schema';
import { fill, isDay } from './texts';

// The booking form's answers by question key: a ticked box is true, a choice its position.
export type Answers = Record<string, string | boolean>;

// A name, an at sign and a domain with a dot: what a mistyped address lacks, without rejecting an
// unusual one, which Beds24's e-mail tells.
const email = (value: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);

// Digits with the signs people write between them; a short number is a typing slip.
const phone = (value: string) =>
  /^\+?[\d\s()./-]+$/.test(value) && value.replace(/\D/g, '').length >= 6;

// ISO 3166-1's codes, which Beds24 takes as a booking's country.
export const countries = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR ' +
  'BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ ' +
  'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW ' +
  'GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY ' +
  'KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV ' +
  'MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY ' +
  'QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG ' +
  'TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

// How each of Beds24's guest fields is asked, what the browser may fill in, and the form a given
// answer must have.
export const guestFields: Record<
  GuestField,
  { input: string; autocomplete: string; valid?: (value: string) => boolean }
> = {
  title: { input: 'text', autocomplete: 'honorific-prefix' },
  firstName: { input: 'text', autocomplete: 'given-name' },
  lastName: { input: 'text', autocomplete: 'family-name' },
  email: { input: 'email', autocomplete: 'email', valid: email },
  phone: { input: 'tel', autocomplete: 'tel', valid: phone },
  mobile: { input: 'tel', autocomplete: 'mobile tel', valid: phone },
  fax: { input: 'tel', autocomplete: 'fax tel', valid: phone },
  company: { input: 'text', autocomplete: 'organization' },
  address: { input: 'text', autocomplete: 'street-address' },
  city: { input: 'text', autocomplete: 'address-level2' },
  state: { input: 'text', autocomplete: 'address-level1' },
  postcode: { input: 'text', autocomplete: 'postal-code' },
  countryText: { input: 'text', autocomplete: 'country-name' },
  countrySelect: {
    input: 'select',
    autocomplete: 'country',
    valid: (value) => countries.includes(value),
  },
  arrivalTime: { input: 'time', autocomplete: 'off', valid: (value) => /^\d\d:\d\d$/.test(value) },
  comments: { input: 'textarea', autocomplete: 'off' },
};

// How a question is asked: an input of that type, a dropdown, several lines or a tick box. A
// list Beds24 shows as radio buttons is a dropdown too, whose first entry undoes a choice.
export const inputOf = (question: Question) =>
  'type' in question
    ? {
        singleLineField: 'text',
        multiLineField: 'textarea',
        multipleSelect: 'select',
        multipleList: 'select',
        tickBox: 'checkbox',
        dateSelector: 'date',
      }[question.type]
    : guestFields[question.key].input;

export const blank = (questions: Question[]): Answers =>
  Object.fromEntries(
    questions.map((question) => [
      question.key,
      'type' in question && question.type === 'tickBox' ? false : '',
    ]),
  );

// A text answer's error: missing where it must be given, or of the wrong form where it is.
const answer =
  (required: boolean, missing: string, valid?: (value: string) => boolean, invalid = missing) =>
  (value: unknown) => {
    const text = String(value);
    return required && text.trim() === ''
      ? missing
      : text !== '' && valid && !valid(text)
        ? invalid
        : null;
  };

// Each answer's check, worded in the page's language: the error it has, or null. The form checks
// with them, and the server again (#349).
export function answerRules(questions: Question[], texts: Texts, code: string) {
  const { custom, fields } = texts.book;
  const rule = (question: Question): ((value: unknown) => string | null) => {
    if (!('type' in question)) {
      const words = fields[question.key];
      return answer(
        question.required,
        words.missing,
        guestFields[question.key].valid,
        'invalid' in words ? words.invalid : undefined,
      );
    }
    const label = { question: question.label[code] };
    if (question.type === 'tickBox')
      return (value) => (question.required && !value ? fill(custom.tick, label) : null);
    const choices = question.choices?.[code];
    return answer(
      question.required,
      fill(choices ? custom.choose : custom.missing, label),
      choices
        ? (value) => /^\d+$/.test(value) && Number(value) < choices.length
        : question.type === 'dateSelector'
          ? isDay
          : undefined,
    );
  };
  return Object.fromEntries(questions.map((question) => [question.key, rule(question)]));
}
