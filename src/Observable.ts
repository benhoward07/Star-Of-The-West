export type Listener<T> = (value: T) => void;

/** A value that tells its listeners whenever it changes. */
export class Observable<T> {
  private listeners = new Set<Listener<T>>();

  constructor(private current: T) {}

  get value(): T {
    return this.current;
  }

  set value(next: T) {
    this.set(next);
  }

  set(next: T): void {
    this.current = next;
    this.listeners.forEach((listener) => listener(next));
  }

  /** Listen for changes. Returns a function that stops listening. */
  subscribe(listener: Listener<T>, fireNow = false): () => void {
    this.listeners.add(listener);
    if (fireNow) listener(this.current);
    return () => this.listeners.delete(listener);
  }
}
