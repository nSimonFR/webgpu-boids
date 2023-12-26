
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
