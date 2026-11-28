import { readQuestions, type BookingSetup } from './questions';

describe('readQuestions', () => {
  const texts = (questions: Record<string, [string, string]>) =>
    ['de', 'en'].map((language, i) => ({
      language,
      ...Object.fromEntries(Object.entries(questions).map(([key, text]) => [key, text[i]])),
    })) as BookingSetup['texts'];
  const property = (change: Partial<BookingSetup> = {}): BookingSetup => ({
    id: 7,
    bookingQuestions: {},
    bookingRules: {
      bookingType: 'confirmedWithDepositCollection1',
      bookingNearType: null,
      bookingNearTypeDays: null,
      bookingExceptionalType: null,
      bookingExceptionalTypeEnd: null,
    },
    paymentCollection: {
      depositPayment1: {
        fixedAmount: 0,
        variableAmount: { type: 'percentage', percentageValue: 100 },
      },
      depositPayment2: {
        fixedAmount: 0,
        variableAmount: { type: 'percentage', percentageValue: 0 },
      },
    },
    ...change,
  });
  const read = (change: Partial<BookingSetup>) =>
    readQuestions(property(change), ['de', 'en'], '2027-01-01');
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('asks what Beds24 asks, in its order, required by its usage', () => {
    expect(
      read({
        bookingQuestions: {
          guestTitle: { usage: 'optional', order: 2 },
          guestFirstName: { usage: 'compulsory', order: 1 },
          guestLastName: { usage: 'compulsoryBookingPage', order: 3 },
          guestEmail: { usage: 'optional', order: 4 },
          guestPhone: { usage: 'compulsoryBookingPage', order: 6 },
          guestMobile: { usage: 'internal', order: 5 },
          guestFax: { usage: 'notUsed', order: null },
          guestCountrySelect: { usage: 'optional', order: 7 },
        },
      }),
    ).toEqual([
      { key: 'firstName', required: true },
      { key: 'title', required: false },
      { key: 'lastName', required: true },
      // Always required: Stripe and the confirmation need it.
      { key: 'email', required: true },
      { key: 'phone', required: true },
      { key: 'countrySelect', required: false },
    ]);
  });

  it('asks the first name, surname and e-mail first where Beds24 does not', () => {
    expect(read({ bookingQuestions: { guestPhone: { usage: 'optional', order: 1 } } })).toEqual([
      { key: 'firstName', required: true },
      { key: 'lastName', required: true },
      { key: 'email', required: true },
      { key: 'phone', required: false },
    ]);
  });

  it("takes a custom question's text per language, and a choice's options from its brackets", () => {
    const questions = read({
      bookingQuestions: {
        customQuestion1: { usage: 'compulsory', order: 1, type: 'multipleSelect' },
        customQuestion2: { usage: 'optional', order: 2, type: 'multipleList' },
        customQuestion3: { usage: 'optional', order: 3, type: 'tickBox' },
        customQuestion4: { usage: 'optional', order: 4, type: 'dateSelector' },
        customQuestion5: { usage: 'optional', order: 5, type: 'singleLineField' },
        customQuestion10: { usage: 'optional', order: 6, type: 'multiLineField' },
      },
      texts: texts({
        customQuestion1: ['Anreise mit [Auto][ Bahn ]', 'Arriving by [Car] [Train]'],
        customQuestion2: ['Kissen [Weich][Fest]', 'Pillows [Soft][Firm]'],
        customQuestion3: ['Babybett ', 'Cot'],
        customQuestion4: ['Skikurs ab', 'Ski school from'],
        customQuestion5: ['Kennzeichen', 'Number plate'],
        customQuestion10: ['Allergien', 'Allergies'],
      }),
    });
    expect(questions?.slice(3)).toEqual([
      {
        key: 'custom1',
        required: true,
        type: 'multipleSelect',
        label: { de: 'Anreise mit', en: 'Arriving by' },
        choices: { de: ['Auto', 'Bahn'], en: ['Car', 'Train'] },
      },
      {
        key: 'custom2',
        required: false,
        type: 'multipleList',
        label: { de: 'Kissen', en: 'Pillows' },
        choices: { de: ['Weich', 'Fest'], en: ['Soft', 'Firm'] },
      },
      { key: 'custom3', required: false, type: 'tickBox', label: { de: 'Babybett', en: 'Cot' } },
      {
        key: 'custom4',
        required: false,
        type: 'dateSelector',
        label: { de: 'Skikurs ab', en: 'Ski school from' },
      },
      {
        key: 'custom5',
        required: false,
        type: 'singleLineField',
        label: { de: 'Kennzeichen', en: 'Number plate' },
      },
      {
        key: 'custom10',
        required: false,
        type: 'multiLineField',
        label: { de: 'Allergien', en: 'Allergies' },
      },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves out an optional question it cannot ask, and says why', () => {
    const questions = read({
      bookingQuestions: {
        customQuestion1: { usage: 'optional', order: 1, type: 'tickBox' },
        customQuestion2: { usage: 'optional', order: 2, type: 'multipleSelect' },
        customQuestion3: { usage: 'optional', order: 3, type: 'slider' },
        guestShoeSize: { usage: 'optional', order: 4 },
      },
      texts: texts({
        customQuestion1: ['Babybett', ''],
        customQuestion2: ['Frühstück', 'Breakfast [Yes][]'],
        customQuestion3: ['Wie viele', 'How many'],
      }),
    });
    expect(questions).toHaveLength(3);
    expect(warn.mock.calls.map(([message]: unknown[]) => message)).toEqual([
      'Property 7: the question customQuestion1 is not supported, as it has no text in en: left out',
      'Property 7: the question customQuestion2 is not supported, as it has no choices in de: left out',
      'Property 7: the question customQuestion3 is not supported, as its type slider is unknown: left out',
      'Property 7: the question guestShoeSize is not supported, as it is unknown: left out',
    ]);
  });

  it('closes the booking for a question it must ask and cannot', () => {
    expect(
      read({
        bookingQuestions: {
          customQuestion1: { usage: 'compulsoryBookingPage', order: 1, type: 'tickBox' },
        },
      }),
    ).toBeNull();
    expect(error).toHaveBeenCalledWith(
      'Property 7: the question customQuestion1 is not supported, as it has no text in de: booking closed',
    );
  });

  it("closes the booking where Beds24's rules take other than the full price at booking", () => {
    const { bookingRules: rules, paymentCollection: payment } = property();
    const deposit = (fixedAmount: number, percentageValue: number | null, type = 'percentage') => ({
      fixedAmount,
      variableAmount: { type, percentageValue },
    });
    for (const change of [
      { bookingRules: { ...rules, bookingType: 'requestWithManualConfirmation' } },
      { bookingRules: { ...rules, bookingType: 'confirmedWithDepositCollection2' } },
      { paymentCollection: { ...payment, depositPayment1: deposit(0, 30) } },
      { paymentCollection: { ...payment, depositPayment1: deposit(100, 100) } },
      { paymentCollection: { ...payment, depositPayment2: deposit(0, 70) } },
      // A share reckoned otherwise than in percent, whatever value it keeps.
      { paymentCollection: { ...payment, depositPayment1: deposit(0, 100, 'firstNight') } },
      { paymentCollection: { ...payment, depositPayment2: deposit(0, null, 'firstNight') } },
      {
        bookingRules: {
          ...rules,
          bookingNearType: 'requestWithCreditCard',
          bookingNearTypeDays: 14,
        },
      },
      {
        bookingRules: {
          ...rules,
          bookingExceptionalType: 'blackoutPeriod',
          bookingExceptionalTypeEnd: '2027-01-01',
        },
      },
    ])
      expect(read(change), JSON.stringify(change)).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "Property 7: Beds24's booking rules ask for other than the full price: booking closed",
    );
  });

  it('takes a near-term or exceptional rule that is off, the same, or passed', () => {
    const { bookingRules: rules } = property();
    for (const change of [
      { bookingNearType: 'requestWithCreditCard', bookingNearTypeDays: null },
      { bookingNearType: 'confirmedWithDepositCollection1', bookingNearTypeDays: 14 },
      { bookingExceptionalType: 'blackoutPeriod', bookingExceptionalTypeEnd: '2026-12-31' },
      {
        bookingExceptionalType: 'confirmedWithDepositCollection1',
        bookingExceptionalTypeEnd: '2027-02-01',
      },
    ])
      expect(
        read({ bookingRules: { ...rules, ...change } }),
        JSON.stringify(change),
      ).not.toBeNull();
    expect(error).not.toHaveBeenCalled();
  });
});
