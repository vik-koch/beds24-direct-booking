import { isDay } from './texts';

describe('isDay', () => {
  it('takes a day of the calendar and nothing else', () => {
    expect(isDay('2027-02-28')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    for (const text of [
      '2027-02-29',
      '2027-02-30',
      '2027-02-00',
      '2027-13-01',
      '2027-2-1',
      'x',
      '',
    ])
      expect(isDay(text)).toBe(false);
  });
});
