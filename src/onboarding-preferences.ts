/** localStorage key: when set to "1", post-creation gameplay tips are not started. */
export const ONBOARDING_SKIP_STORAGE_KEY = "camelot_skip_onboarding_tips";

export function shouldSkipOnboardingTips(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ONBOARDING_SKIP_STORAGE_KEY) === "1";
}

export function persistSkipOnboardingTips(skip: boolean): void {
  if (typeof localStorage === "undefined") return;
  if (skip) localStorage.setItem(ONBOARDING_SKIP_STORAGE_KEY, "1");
  else localStorage.removeItem(ONBOARDING_SKIP_STORAGE_KEY);
}
