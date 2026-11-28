import type { Question } from '../beds24/questions';
import texts from '../content/generated/texts.en';
import type { Language } from '../content/schema';
import { answerRules, blank, inputOf } from './answers';

describe('answerRules', () => {
  const custom = (key: `custom${number}`, change: Partial<Question>): Question =>
    ({
      key,
      required: true,
      type: 'singleLineField',
      label: { en: 'Arriving by' },
      ...change,
    }) as Question;
  const questions: Question[] = [
    { key: 'firstName', required: true },
    { key: 'email', required: true },
    { key: 'phone', required: false },
    { key: 'countrySelect', required: true },
    { key: 'arrivalTime', required: false },
    custom('custom1', { type: 'multipleSelect', choices: { en: ['Car', 'Train'] } }),
    custom('custom2', { type: 'tickBox', label: { en: 'I have read the house rules' } }),
    custom('custom3', { type: 'dateSelector', required: false, label: { en: 'Ski school from' } }),
    custom('custom4', { type: 'tickBox', required: false, label: { en: 'Cot' } }),
  ];
  const rules = answerRules(questions, texts, { code: 'en', tag: 'en-GB' } as Language);
  const valid = {
    firstName: 'Ada',
    email: 'ada@example.com',
    phone: '',
    countrySelect: 'AT',
    arrivalTime: '',
    custom1: '1',
    custom2: true,
    custom3: '',
    custom4: false,
  };
  // Each answer's error, by its question.
  const errors = (answers: object) => {
    const all = { ...valid, ...answers };
    return Object.fromEntries(
      Object.entries(all).flatMap(([key, value]) => {
        const error = rules[key](value, all);
        return error ? [[key, error]] : [];
      }),
    );
  };

  it('takes answers of their form, an optional one left empty', () => {
    expect(errors({})).toEqual({});
    expect(
      errors({ phone: '+43 (0)662 12-34/56', arrivalTime: '17:30', custom3: '2027-02-06' }),
    ).toEqual({});
  });

  it('takes an answer not sent at all, as a post may leave one out, for a missing one', () => {
    expect(errors({ firstName: null, email: undefined })).toEqual({
      firstName: 'Enter your first name.',
      email: 'Enter your e-mail address.',
    });
  });

  it('names what is missing, in the words of the field or the question', () => {
    expect(
      errors({ firstName: ' ', email: '', countrySelect: '', custom1: '', custom2: false }),
    ).toEqual({
      firstName: 'Enter your first name.',
      email: 'Enter your e-mail address.',
      countrySelect: 'Choose your country.',
      custom1: 'Choose an answer to “Arriving by”.',
      custom2: 'Tick “I have read the house rules” to book.',
    });
  });

  it('names an answer of the wrong form, and how to write it', () => {
    expect(
      errors({
        email: 'ada@',
        phone: 'call me',
        countrySelect: 'XX',
        arrivalTime: 'soon',
        custom1: '2',
        custom3: '2027-02-30',
      }),
    ).toEqual({
      email: 'Enter an e-mail address such as name@example.com.',
      // Of no country: the example is of the page's language's region.
      phone: 'Enter a full phone number, with its country code, such as +44 7400 123456.',
      countrySelect: 'Choose your country.',
      arrivalTime: 'Enter the time you expect to arrive.',
      custom1: 'Choose an answer to “Arriving by”.',
      custom3: 'Answer “Ski school from”.',
    });
    // Too few digits for a French number; Austria has numbers that short.
    expect(errors({ phone: '12 34', countrySelect: 'FR' })).toEqual({
      phone: 'Enter a full phone number, with its country code, such as +33 6 12 34 56 78.',
    });
    // Signs between digits only: libphonenumber alone would drop the trailing ones.
    for (const phone of [
      '+44 20 7946 0000....',
      '+44 20-79460000;',
      '+44 20 7946 0000.',
      '0664//123456',
    ])
      expect(errors({ phone })).toEqual({
        phone: 'Enter a full phone number, with its country code, such as +43 664 123456.',
      });
    // Hours and minutes of the clock only.
    for (const arrivalTime of ['24:00', '29:75', '17:60'])
      expect(errors({ arrivalTime })).toEqual({
        arrivalTime: 'Enter the time you expect to arrive.',
      });
    expect(errors({ arrivalTime: '23:59' })).toEqual({});
    expect(errors({ firstName: 'Ada2' })).toEqual({
      firstName: 'Enter your first name in letters.',
    });
  });

  it("reads a number written as at home in the guest's country, and any with its country code", () => {
    const local = { phone: '06 12 34 56 78' };
    const invalid = (example: string) => ({
      phone: `Enter a full phone number, with its country code, such as ${example}.`,
    });
    expect(errors({ ...local, countrySelect: 'FR' })).toEqual({});
    expect(errors({ phone: '06.12.34.56.78', countrySelect: 'FR' })).toEqual({});
    // In the United Kingdom, or with no country chosen yet, it is not whole; the example is the
    // country's, else the page's language's region's.
    expect(errors({ ...local, countrySelect: 'GB' })).toEqual(invalid('+44 7400 123456'));
    expect(errors({ ...local, countrySelect: '' })).toEqual({
      ...invalid('+44 7400 123456'),
      countrySelect: 'Choose your country.',
    });
    expect(errors({ phone: '+33 6 12 34 56 78', countrySelect: 'GB' })).toEqual({});
    // A French mobile number one digit short.
    expect(errors({ phone: '06 12 34 56 7', countrySelect: 'FR' })).toEqual(
      invalid('+33 6 12 34 56 78'),
    );
    // Names of any script and sign pass.
    expect(errors({ firstName: "Zoë-Anne O'Brien" })).toEqual({});
    expect(errors({ firstName: 'Łukasz' })).toEqual({});
    expect(errors({ firstName: '美咲' })).toEqual({});
  });

  it('starts every answer empty, and asks each by its kind', () => {
    expect(blank(questions)).toEqual({
      ...Object.fromEntries(Object.keys(valid).map((key) => [key, ''])),
      custom2: false,
      custom4: false,
    });
    expect(questions.map(inputOf)).toEqual([
      'text',
      'email',
      'tel',
      'select',
      'time',
      'select',
      'checkbox',
      'date',
      'checkbox',
    ]);
  });
});
