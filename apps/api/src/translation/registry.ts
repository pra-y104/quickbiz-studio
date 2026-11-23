/**
 * Translation provider registry.
 *
 * This build registers no translation adapter: a live provider needs a key and
 * owner approval, both absent here. The resolver therefore returns `null`, which
 * makes the route fail closed with 503 rather than pretend to translate.
 *
 * The seam is explicit so a real adapter can be dropped in later without editing
 * the route: implement `TranslationProvider` and return it from here.
 */

import type { Bindings } from '../config/env';
import type { TranslationProvider } from './provider';

export function resolveTranslationProvider(_bindings: Bindings): TranslationProvider | null {
  // No provider is configured in this build. A future adapter (with an approved,
  // funded key) would be constructed here and returned.
  return null;
}
