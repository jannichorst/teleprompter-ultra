export function enterFullscreen(el: HTMLElement) {
  el.requestFullscreen?.();
}

export function exitFullscreen() {
  document.exitFullscreen?.();
}

export function isFullscreenElement(el: HTMLElement | null): boolean {
  return document.fullscreenElement === el;
}
