type Child = Node | string | null | undefined | false;

/**
 * Small helper for building page elements.
 *
 *   el('button', { class: 'btn', onClick: () => ... }, 'Begin')
 *
 * `class` sets the class name, `onXxx` adds an event listener, and `html`
 * sets inner markup (only ever used with this app's own built-in artwork).
 * Everything else becomes an attribute. Text children are always plain text.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  add(node, ...children);
  return node;
}

/** Append children to an element, skipping any that are null, undefined or false. */
export function add(parent: HTMLElement, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child);
  }
}

/** Remove everything inside an element. */
export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Short buzz on phones that support it (iPhone Safari does not; that is fine). */
export function buzz(pattern: number | number[]): void {
  try {
    // Browsers only allow vibration after the player has tapped the page.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: ignore.
  }
}
