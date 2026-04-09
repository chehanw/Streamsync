/**
 * Dev-only runtime flags
 *
 * Module-level state that persists across re-renders without React.
 * Set these BEFORE triggering re-renders so layout/index guards
 * pick them up on the next render cycle.
 *
 * Remove this file (and all usages) before production release.
 */

let _skipAuth = false;

/** Call before notifyOnboardingComplete() to bypass the auth gate. */
export function devSkipAuth(): void {
  if (__DEV__) _skipAuth = true;
}

/** Returns true when the dev auth bypass is active. */
export function isDevAuthSkipped(): boolean {
  return __DEV__ && _skipAuth;
}
