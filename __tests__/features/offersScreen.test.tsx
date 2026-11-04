import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, jest } from '@jest/globals';
import '@/i18n';
import { useLanguageStore } from '@/state/languageStore';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';
import { FilterSheet } from '@/features/offers/FilterSheet';
import OffersScreen from '@/app/(drawer)';
import ContactsScreen from '@/app/(drawer)/contacts';
import TermsScreen from '@/app/(drawer)/terms';
import OfferDetailScreen from '@/app/offers/[id]';
import LoginScreen from '@/app/(drawer)/login';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'offer001' }),
}));
jest.mock('expo-image', () => ({ Image: 'View' }));

describe('filter sheet', () => {
  it('closes when the backdrop is pressed', async () => {
    useLanguageStore.getState().setLanguage('en');
    const onClose = jest.fn();

    await render(
      <FilterSheet
        member={false}
        filter={{}}
        sort="date"
        categories={[]}
        locations={[]}
        onApply={jest.fn()}
        onClose={onClose}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe('guest offers screen', () => {
  it('lists offers by date without price or availability, flags past ones', async () => {
    useLanguageStore.getState().setLanguage('en');
    await renderWithQuery(<OffersScreen />);
    await screen.findByText('Ski trip in the Alps');

    const titles = screen
      .getAllByText(
        /Ski trip in the Alps|Weekend on Kopaonik|Past excursion|Summer camp/,
      )
      .map((node) => node.props.children);
    expect(titles).toHaveLength(4);
    expect(titles[0]).toBe('Ski trip in the Alps');
    expect(titles.indexOf('Past excursion')).toBeGreaterThan(
      titles.indexOf('Weekend on Kopaonik'),
    );
    expect(titles.indexOf('Summer camp')).toBeGreaterThan(
      titles.indexOf('Past excursion'),
    );

    expect(
      screen.queryByText(/PAST|RSD|AVAILABLE|SOLD OUT|Coming Soon/),
    ).toBeNull();
    expect(screen.queryByText('Favorites Only')).toBeNull();
    expect(screen.getAllByText('☆')[0].props.style.color).toBe(
      colors.accentGold,
    );
  });

  it('filters by category chip and clears all', async () => {
    useLanguageStore.getState().setLanguage('en');
    await renderWithQuery(<OffersScreen />);
    await screen.findByText('Ski trip in the Alps');

    await fireEvent.press(screen.getByText('Filter Offers'));
    expect(screen.queryByText('Price Range')).toBeNull();
    expect(screen.queryByText('Available Only')).toBeNull();
    await fireEvent.press(screen.getAllByText('Camp').at(-1)!);
    await fireEvent.press(screen.getByText('Apply'));

    expect(screen.queryByText('Ski trip in the Alps')).toBeNull();
    expect(screen.getByText('Summer camp')).toBeTruthy();

    await fireEvent.press(screen.getByText('Clear All'));
    expect(screen.getByText('Ski trip in the Alps')).toBeTruthy();
  });
});

describe('login screen', () => {
  it('toggles password masking from the visibility button', async () => {
    useLanguageStore.getState().setLanguage('en');
    await render(<LoginScreen />);

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });
});

describe('guest offer details', () => {
  it('shows membership contact details before opening the phone app', async () => {
    useLanguageStore.getState().setLanguage('en');
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined);

    await renderWithQuery(<OfferDetailScreen />);
    await screen.findByText('Ski trip in the Alps');
    await fireEvent.press(screen.getByText('How to get membership'));

    expect(
      screen.getByText(
        'Contact the club office at this number to ask about joining:',
      ),
    ).toBeTruthy();
    expect(screen.getByText('+381 600 218 657')).toBeTruthy();
    expect(openURL).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Call'));
    expect(openURL).toHaveBeenCalledWith('tel:+381600218657');
    openURL.mockRestore();
  });

  it('shows the favorite prompt when a guest taps the detail star', async () => {
    useLanguageStore.getState().setLanguage('en');
    useAuthStore.getState().clearUser();

    await renderWithQuery(<OfferDetailScreen />);
    await screen.findByText('Ski trip in the Alps');
    expect(screen.getByText('☆')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Toggle favorite'));

    expect(
      screen.getByText(
        'Please log in or become a member to add offers to your favorites.',
      ),
    ).toBeTruthy();
  });
});

describe('static screens', () => {
  it('shows the contact links', async () => {
    useLanguageStore.getState().setLanguage('en');
    await render(<ContactsScreen />);
    expect(screen.getByText('+381 600 218 657')).toBeTruthy();
    expect(screen.getByText('info@skimanijaci.com')).toBeTruthy();
  });

  it('renders terms in the selected language', async () => {
    useLanguageStore.getState().setLanguage('sr');
    await render(<TermsScreen />);
    expect(screen.getAllByText(/uslovi/).length).toBeGreaterThan(0);
  });
});
