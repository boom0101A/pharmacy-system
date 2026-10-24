import { create } from 'zustand';

const DARK_KEY = 'pharmacy.appearance.dark';
const PERF_KEY = 'pharmacy.appearance.perf';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Not remembered across restarts; the switch itself still works.
  }
}

/**
 * The theme lives as classes on <html>: `.dark` switches tokens.css to the
 * dark palette, and `.perf` drops blur, translucency and the moving backdrop.
 */
function apply(className: 'dark' | 'perf', on: boolean) {
  document.documentElement.classList.toggle(className, on);
}

interface AppearanceState {
  dark: boolean;
  perf: boolean;
  setDark: (on: boolean) => void;
  setPerf: (on: boolean) => void;
}

/**
 * One shared state, not one per component: the top bar's moon button and the
 * settings page's switch are two views of the same choice, and flipping one
 * has to move the other.
 */
const useAppearanceStore = create<AppearanceState>((set) => ({
  dark: read(DARK_KEY),
  perf: read(PERF_KEY),
  setDark: (on) => {
    write(DARK_KEY, on);
    apply('dark', on);
    set({ dark: on });
  },
  setPerf: (on) => {
    write(PERF_KEY, on);
    apply('perf', on);
    set({ perf: on });
  },
}));

/**
 * Called once in main.tsx before React mounts, so the first frame is already
 * in the saved theme. (The window only shows after that first paint, behind
 * the splash, so there's no light flash on a dark-mode machine either.)
 */
export function applyStoredAppearance() {
  const dark = read(DARK_KEY);
  const perf = read(PERF_KEY);
  apply('dark', dark);
  apply('perf', perf);
  useAppearanceStore.setState({ dark, perf });
}

/**
 * Dark mode and performance mode. Per machine, like the POS products toggle:
 * a slow till wants performance mode, the office PC beside it doesn't — so
 * this never goes to the server.
 */
export function useAppearance() {
  return useAppearanceStore();
}
