export const rand = (min?: number, max?: number): number => {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

let then = 0;
export const setFPSCounter = (now: number, infoElem: Element | null) => {
  if (!infoElem) return;

  now *= 0.001;  // convert to seconds
  const deltaTime = now - then;
  then = now;

  const fps = 1 / deltaTime;
  infoElem!.textContent = fps < 10 ? fps.toFixed(1) : fps.toFixed(0);
};

export type Pointer = {
  x: number;
  y: number;
  strength: number;
  update: (now: number, dt: number) => void;
};

// Pointer position plus a 0..1 strength that eases out once the pointer stops.
export const createPointer = (): Pointer => {
  let last = -Infinity;
  const pointer: Pointer = {
    x: 0,
    y: 0,
    strength: 0,
    update: (now, dt) => {
      const target = now - last < 1200 ? 1 : 0;
      pointer.strength += (target - pointer.strength) * Math.min(1, dt * 4);
    },
  };
  window.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    last = performance.now();
  }, { passive: true });
  document.addEventListener("pointerleave", () => {
    last = -Infinity;
  });
  return pointer;
};
