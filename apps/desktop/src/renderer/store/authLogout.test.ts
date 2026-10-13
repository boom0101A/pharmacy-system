import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {},
  ApiError: class extends Error {},
  getToken: () => null,
  setToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const { useAuth } = await import('./auth');
const { useCart } = await import('./cart');

describe('auth clears the cart', () => {
  it.each(['logout', 'sessionExpired'] as const)('%s empties the cart and its discount', (action) => {
    useCart.setState({ lines: [{ productId: 1, quantity: 1, isSubUnit: false, product: {} as never }], discount: 5 });
    useAuth.getState()[action]();
    expect(useCart.getState().lines).toHaveLength(0);
    expect(useCart.getState().discount).toBe(0);
  });
});
