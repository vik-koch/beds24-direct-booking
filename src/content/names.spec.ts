import { placesOf } from './names';
import type { Picture } from './schema';

const picture = (name: string, season?: Picture['season']): Picture => ({
  alt: { de: name },
  ...(season && { season }),
  width: 3,
  height: 2,
  sources: [],
});

describe('placesOf', () => {
  it('pairs each season’s pictures place by place, and keeps a picture of both seasons once', () => {
    const [room, roomWinter, bath, balcony, balconyWinter] = [
      picture('room', 'summer'),
      picture('room in winter', 'winter'),
      picture('bath'),
      picture('balcony', 'summer'),
      picture('balcony in winter', 'winter'),
    ];
    const list = [room, roomWinter, bath, balcony, balconyWinter];
    const both = (one: Picture) => [{ picture: one, season: null }];
    const each = (winter: Picture, summer: Picture) => [
      { picture: winter, season: 'winter' },
      { picture: summer, season: 'summer' },
    ];
    expect(placesOf(list, ['winter', 'summer'])).toEqual([
      each(roomWinter, room),
      both(bath),
      each(balconyWinter, balcony),
    ]);
    expect(placesOf([bath, room], ['summer'])).toEqual([both(bath), both(room)]);
  });

  it('names the season that shows a picture where the seasons place it differently', () => {
    const [terrace, bath, terraceWinter] = [
      picture('terrace', 'summer'),
      picture('bath'),
      picture('terrace in winter', 'winter'),
    ];
    // Summer: terrace, bath; winter: bath, terrace in winter.
    expect(placesOf([terrace, bath, terraceWinter], ['winter', 'summer'])).toEqual([
      [
        { picture: bath, season: 'winter' },
        { picture: terrace, season: 'summer' },
      ],
      [
        { picture: terraceWinter, season: 'winter' },
        { picture: bath, season: 'summer' },
      ],
    ]);
  });
});
