const STORAGE_KEY = 'crawl4ai_onboarding_complete';

export function isOnboardingComplete(): boolean {
  if (import.meta.env.VITE_DISABLE_ONBOARDING === 'true') {
    return true;
  }

  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markOnboardingComplete(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}
