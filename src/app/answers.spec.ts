import type { Question } from '../beds24/questions';
import texts from '../content/generated/texts.en';
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
  const rules = answerRules(questions, texts, 'en');
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
  const errors = (answers: object) =>
    Object.fromEntries(
      Object.entries({ ...valid, ...answers }).flatMap(([key, value]) => {
        const error = rules[key](value);
        return error ? [[key, error]] : [];
      }),
    );

  it('takes answers of their form, an optional one left empty', () => {
    expect(errors({})).toEqual({});
    expect(
      errors({ phone: '+43 (0)662 12-34/56', arrivalTime: '17:30', custom3: '2027-02-06' }),
    ).toEqual({});
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
      phone: 'Enter a phone number in digits, such as +44 20 7946 0000.',
      countrySelect: 'Choose your country.',
      arrivalTime: 'Enter the time you expect to arrive.',
      custom1: 'Choose an answer to “Arriving by”.',
      custom3: 'Answer “Ski school from”.',
    });
    // Too few digits for any number.
    expect(errors({ phone: '12 34' })).toEqual({
      phone: 'Enter a phone number in digits, such as +44 20 7946 0000.',
    });
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
