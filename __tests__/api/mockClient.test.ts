import { describe, expect, it } from '@jest/globals';
import { MockApiClient } from '@/api/mockClient';

describe('mock API contract', () => {
  it('strips member-only offer fields for guests and returns them for signed-in users', async () => {
    const api = new MockApiClient();
    const guestOffers = await api.getOffers();
    for (const field of [
      'price',
      'priceAmount',
      'currency',
      'isPriceComingSoon',
      'availablePlaces',
      'applicationDeadline',
    ]) {
      expect(guestOffers[0]).not.toHaveProperty(field);
    }

    const session = await api.login({
      username: 'demo',
      password: 'mock-password',
    });
    const memberOffers = await api.getOffers(session.accessToken);
    expect(memberOffers[0]).toHaveProperty('priceAmount', 899);
  });

  it('requires authentication for profile and favorites operations', async () => {
    const api = new MockApiClient();
    await expect(api.getMe('invalid')).rejects.toMatchObject({ status: 401 });
  });

  it('strips member-only fields after the mock session is deleted', async () => {
    const api = new MockApiClient();
    const session = await api.login({
      username: 'demo',
      password: 'mock-password',
    });
    await api.deleteMe(session.accessToken);
    const offers = await api.getOffers(session.accessToken);
    expect(offers[0]).not.toHaveProperty('priceAmount');
    await expect(api.refresh(session.refreshToken)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects admin API operations for non-admin users', async () => {
    const api = new MockApiClient();
    const session = await api.login({
      username: 'member',
      password: 'mock-password',
    });
    await expect(api.getUsers(session.accessToken)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('allows the admin mock role to access admin endpoints', async () => {
    const api = new MockApiClient(true);
    const session = await api.login({
      username: 'admin',
      password: 'mock-password',
    });
    await expect(api.getUsers(session.accessToken)).resolves.toHaveLength(1);
  });
});
