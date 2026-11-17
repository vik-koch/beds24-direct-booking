import { cached } from './cache';

describe('cached', () => {
  let time = 0;
  const now = () => time;
  beforeEach(() => (time = 0));

  it('serves a fresh answer without asking again', async () => {
    const load = vi.fn(async () => time);
    const get = cached(load, 100, 1000, 50, now);
    expect(await get()).toBe(0);
    time = 99;
    expect(await get()).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves a stale answer while it refreshes behind it', async () => {
    const load = vi.fn(async () => time);
    const get = cached(load, 100, 1000, 50, now);
    await get();
    time = 150;
    expect(await get()).toBe(0);
    await new Promise((settle) => setTimeout(settle));
    expect(await get()).toBe(150);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good answer while Beds24 fails, until it is too old', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = false;
    const get = cached(
      async () => {
        if (fail) throw new Error('down');
        return time;
      },
      100,
      1000,
      50,
      now,
    );
    await get();
    fail = true;
    time = 500;
    expect(await get()).toBe(0);
    time = 1000;
    await expect(get()).rejects.toThrow('down');
  });

  it('shares one call between callers at the same moment', async () => {
    const load = vi.fn(async () => time);
    const get = cached(load, 100, 1000, 50, now);
    expect(await Promise.all([get(), get()])).toEqual([0, 0]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('waits a pause after a failure before it asks Beds24 again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi.fn(async () => {
      throw new Error('down');
    });
    const get = cached(load, 100, 1000, 50, now);
    await expect(get()).rejects.toThrow('down');
    time = 49;
    await expect(get()).rejects.toThrow('down');
    expect(load).toHaveBeenCalledTimes(1);
    time = 50;
    await expect(get()).rejects.toThrow('down');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not refresh a stale answer behind it during the pause', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error('down');
      return time;
    });
    const get = cached(load, 100, 1000, 50, now);
    await get();
    fail = true;
    time = 200;
    expect(await get()).toBe(0);
    await new Promise((settle) => setTimeout(settle));
    time = 220;
    expect(await get()).toBe(0);
    expect(load).toHaveBeenCalledTimes(2);
    time = 260;
    expect(await get()).toBe(0);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
