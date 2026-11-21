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
    expect(placesOf(list, ['winter', 'summer'])).toEqual([
      [roomWinter, room],
      [bath],
      [balconyWinter, balcony],
    ]);
    expect(placesOf([bath, room], ['summer'])).toEqual([[bath], [room]]);
  });
});
