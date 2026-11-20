/**
 * Undo and redo.
 *
 * The stack stores whole documents, not inverse operations. That is a deliberate
 * trade: every command is already a pure function, so restoring the previous
 * value cannot drift out of sync with the current one, and a bug in one command
 * cannot corrupt the history of another.
 *
 * Two safeguards keep memory bounded:
 *
 * - a fixed maximum depth (50 by default),
 * - coalescing, so a drag that emits thirty updates creates one history entry.
 */

import type { CreativeDocument } from '@quickbiz/shared';

export const DEFAULT_HISTORY_LIMIT = 50;

export interface HistoryOptions {
  readonly limit?: number;
}

export class DocumentHistory {
  #past: CreativeDocument[] = [];
  #future: CreativeDocument[] = [];
  readonly #limit: number;
  #current: CreativeDocument;
  /** Set while a gesture is in progress so intermediate states are coalesced. */
  #coalescing = false;
  #coalesceKey: string | null = null;
  #coalesceStarted = false;

  constructor(initial: CreativeDocument, options: HistoryOptions = {}) {
    this.#current = initial;
    this.#limit = Math.max(1, options.limit ?? DEFAULT_HISTORY_LIMIT);
  }

  get current(): CreativeDocument {
    return this.#current;
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  get depth(): number {
    return this.#past.length;
  }

  /**
   * Record a new document state.
   *
   * `key` coalesces consecutive updates that belong to one gesture (for example
   * `drag:<nodeId>`); a different key always starts a new entry.
   */
  commit(next: CreativeDocument, options: { readonly key?: string } = {}): void {
    if (next === this.#current) return;

    const key = options.key ?? null;
    const coalesce = this.#coalescing && key !== null && key === this.#coalesceKey;

    if (!coalesce) {
      this.#past.push(this.#current);
      if (this.#past.length > this.#limit) this.#past.shift();
      this.#coalesceStarted = false;
    } else if (!this.#coalesceStarted) {
      // The first update of a gesture records the state it started from.
      this.#past.push(this.#current);
      if (this.#past.length > this.#limit) this.#past.shift();
      this.#coalesceStarted = true;
    }

    this.#coalesceKey = key;
    this.#current = next;
    this.#future = [];
  }

  /** Group the following commits under one history entry. */
  beginGesture(key: string): void {
    this.#coalescing = true;
    this.#coalesceKey = key;
    this.#coalesceStarted = false;
  }

  endGesture(): void {
    this.#coalescing = false;
    this.#coalesceKey = null;
  }

  /** Replace the current state without adding a history entry (load, undo of a delete). */
  reset(document: CreativeDocument): void {
    this.#past = [];
    this.#future = [];
    this.#current = document;
    this.#coalesceKey = null;
    this.#coalescing = false;
  }

  undo(): CreativeDocument | null {
    const previous = this.#past.pop();
    if (previous === undefined) return null;
    this.#future.push(this.#current);
    this.#current = previous;
    this.#coalesceKey = null;
    return previous;
  }

  redo(): CreativeDocument | null {
    const next = this.#future.pop();
    if (next === undefined) return null;
    this.#past.push(this.#current);
    this.#current = next;
    this.#coalesceKey = null;
    return next;
  }

  /** Drop the redo branch, used when the document is replaced by a load. */
  clear(): void {
    this.#past = [];
    this.#future = [];
    this.#coalesceKey = null;
    this.#coalescing = false;
  }
}
