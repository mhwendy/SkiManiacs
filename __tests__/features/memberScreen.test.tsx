import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';
import OffersScreen from '@/app/(drawer)';
import { MockApiClient } from '@/api/mockClient';
import { login, clearSession } from '@/features/auth/session';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { useLanguageStore } from '@/state/languageStore';
import { apiClient } from '@/api';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('expo-image', () => ({ Image: 'View' }));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(async () => {
  await clearSession();
  await useFavoritesStore.getState().reset(true);
  useLanguageStore.getState().setLanguage('en');
});

describe('guest favorites', () => {
  it('shows a login prompt instead of toggling', async () => {
    await renderWithQuery(<OffersScreen />);
    await screen.findByText('Ski trip in the Alps');
    await fireEvent.press(screen.getAllByLabelText('Toggle favorite')[0]);
    expect(
      screen.getByText(/Please log in to add offers to your favorites/),
    ).toBeTruthy();
    expect(useFavoritesStore.getState().ids).toEqual([]);
  });
});

describe('member offers screen', () => {
  it('shows price, availability and the past badge', async () => {
    await login('ana', 'Secret!1', apiClient);
    await renderWithQuery(<OffersScreen />);
    await screen.findByText('Ski trip in the Alps');
    expect(screen.getByText('PAST')).toBeTruthy();
    expect(screen.getAllByText('SOLD OUT')[0]).toBeTruthy();
    expect(screen.getAllByText('AVAILABLE').length).toBeGreaterThan(0);
    expect(screen.getByText('Coming Soon')).toBeTruthy();
  });

  it('toggles a favorite and filters by favorites only', async () => {
    await login('ana', 'Secret!1', apiClient);
    await useFavoritesStore.getState().load('ana');
    await renderWithQuery(<OffersScreen />);
    await screen.findByText('Ski trip in the Alps');
    await fireEvent.press(screen.getAllByLabelText('Toggle favorite')[0]);
    expect(useFavoritesStore.getState().ids).toHaveLength(1);

    await fireEvent.press(screen.getByText('Filter Offers'));
    expect(screen.getByText('Price Range')).toBeTruthy();
    await fireEvent(
      screen.getByLabelText('Favorites Only'),
      'valueChange',
      true,
    );
    await fireEvent.press(screen.getByText('Apply'));
    expect(screen.getAllByLabelText('Toggle favorite')).toHaveLength(1);
  });
});

it('keeps the mock client constructible for isolated tests', () => {
  expect(new MockApiClient()).toBeTruthy();
});
