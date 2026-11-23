// Moves one block out of a box and the next one in, in the same place: from the side the
// direction gives, or by a cross-fade without one. The leaving block is marked data-leaving, so
// the styles keep it shown while it moves. The box grows while they move and shrinks only after
// they have, so the leaving block is not cut off. Each swapper cancels its own previous swap,
// which the next one starts from where things are. Returns whether it moved anything.
export function swapper() {
  let moves: Animation[] = [];
  return (
    box: HTMLElement,
    old: HTMLElement,
    next: HTMLElement,
    direction: number,
    before: number,
  ) => {
    moves.forEach((one) => one.cancel());
    box.querySelectorAll('[data-leaving]').forEach((one) => one.removeAttribute('data-leaving'));
    // Above the view, under the header too, the box changes at once: the browser keeps what is
    // read below in place, and step by step it would shake by a pixel on each step.
    const header = document.querySelector('app-header')!.getBoundingClientRect().bottom;
    const above = box.getBoundingClientRect().bottom <= header;
    if (above || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    old.setAttribute('data-leaving', '');
    const after = next.offsetHeight;
    const duration = direction ? 450 : 600;
    const grows = after > before;
    const resize = Math.abs(after - before) < 1 ? 0 : grows ? duration : 250;
    const timing = (length: number, delay: number) => ({
      duration: length,
      delay,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      fill: 'both' as const,
    });
    // A whole width, grounds that reach the box's edges included.
    const width = box.offsetWidth;
    const blocks = direction
      ? [
          old.animate({ translate: ['0', `${-direction * width}px 0`] }, timing(duration, 0)),
          next.animate({ translate: [`${direction * width}px 0`, '0'] }, timing(duration, 0)),
        ]
      : [
          old.animate({ opacity: [1, 0] }, timing(duration, 0)),
          next.animate({ opacity: [0, 1] }, timing(duration, 0)),
        ];
    const card = resize
      ? [
          box.animate(
            { height: [`${before}px`, `${after}px`] },
            timing(resize, grows ? 0 : duration),
          ),
        ]
      : [];
    moves = [...blocks, ...card];
    // The leaving block stays where its move ended until it is gone, which is as soon as it has
    // moved, not once the box has shrunk after it.
    const end = (parts: Animation[], then: () => void) =>
      Promise.all(parts.map((one) => one.finished)).then(
        () => {
          then();
          parts.forEach((one) => one.cancel());
        },
        // Cancelled by the next swap.
        () => undefined,
      );
    end(blocks, () => old.removeAttribute('data-leaving'));
    end(card, () => undefined);
    return true;
  };
}
