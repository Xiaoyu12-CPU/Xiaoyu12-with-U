/** Shared chrome setup for the frameless floating overlay windows. */
export function applyWindowChrome(): void {
  document.documentElement.classList.add("overlay-window");
  document.body.classList.add("overlay-window");
}
