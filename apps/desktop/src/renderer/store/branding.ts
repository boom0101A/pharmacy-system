import { create } from 'zustand';
import { api, getServerUrl } from '../lib/api';

interface BrandingState {
  /** null = no logo uploaded — the sidebar/login screen fall back to the default icon. */
  logoUrl: string | null;
  refresh: () => Promise<void>;
}

export const useBranding = create<BrandingState>((set) => ({
  logoUrl: null,

  async refresh() {
    try {
      const { hasLogo, updatedAt } = await api.branding();
      set({
        logoUrl: hasLogo ? `${getServerUrl()}/uploads/pharmacy/logo.png?v=${encodeURIComponent(updatedAt!)}` : null,
      });
      // Keeps this till's local print cache in sync in the background — a
      // slow or offline server here must never block showing the app.
      window.pharmacy.syncLogo(getServerUrl(), updatedAt).catch(() => {});
    } catch {
      // Server unreachable at boot — keep whatever was shown before (or the default icon) rather than erroring the whole app over a logo.
    }
  },
}));
