/** localStorage key: when set to "1", post-creation gameplay tips are not started. */
export const ONBOARDING_SKIP_STORAGE_KEY = "camelot_skip_onboarding_tips";

/** When set to "1", the player finished the tip sequence (do not auto-start on reload). */
export const ONBOARDING_DONE_STORAGE_KEY = "camelot_onboarding_tips_done";

export function shouldSkipOnboardingTips(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ONBOARDING_SKIP_STORAGE_KEY) === "1";
}

export function hasCompletedOnboardingTips(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ONBOARDING_DONE_STORAGE_KEY) === "1";
}

export function persistSkipOnboardingTips(skip: boolean): void {
  if (typeof localStorage === "undefined") return;
  if (skip) localStorage.setItem(ONBOARDING_SKIP_STORAGE_KEY, "1");
  else localStorage.removeItem(ONBOARDING_SKIP_STORAGE_KEY);
}

export function persistOnboardingTipsCompleted(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ONBOARDING_DONE_STORAGE_KEY, "1");
}
