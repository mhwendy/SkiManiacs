import {
  ApiError,
  type ApiClient,
  type AuthResponse,
  type CreateOfferInput,
  type CreateUserInput,
  type ProfileUpdate,
  type ProfileResult,
  type UpdateOfferInput,
  type UpdateUserInput,
  type UploadSignInput,
  type UploadSignature,
  type CsvImportResult,
} from './client';
import { mockOffers } from './mockOffers';
import { toGuestOffer } from '@/domain/offers';
import { validatePassword } from '@/domain/users';
import type { Offer, User } from '@/domain/types';

const mockAccessToken = 'local-mock-access-token';
const mockRefreshToken = 'local-mock-refresh-token';

export class MockApiClient implements ApiClient {
  private user: User | null = null;
  private readonly users: User[] = [];
  private readonly offers: Offer[] = mockOffers.map((offer) => ({ ...offer }));
  private readonly favoriteOfferIds = new Set<string>();
  private readonly passwords = new Map<string, string>();

  constructor(private readonly adminMode = false) {}

  async login({
    username,
    password,
  }: {
    username: string;
    password: string;
  }): Promise<AuthResponse> {
    if (!username.trim() || !password) {
      throw new ApiError('Invalid credentials', 401);
    }

    // The mock registers a demo account on first use and then enforces its password.
    const knownPassword = this.passwords.get(username.trim());
    if (knownPassword !== undefined && knownPassword !== password) {
      throw new ApiError('Invalid credentials', 401);
    }
    const existing = this.users.find((u) => u.username === username.trim());
    if (existing && !existing.isActive) {
      throw new ApiError('Invalid credentials', 401);
    }
    this.passwords.set(username.trim(), password);

    this.user = existing ?? {
      username: username.trim(),
      name: 'Demo',
      surname: 'User',
      email: `${username.trim()}@example.invalid`,
      isAdmin: this.adminMode,
      isActive: true,
    };
    if (!existing) {
      this.users.push(this.user);
    }

    return {
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      user: this.user,
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<Pick<AuthResponse, 'accessToken' | 'refreshToken'>> {
    if (refreshToken !== mockRefreshToken || !this.user?.isActive) {
      throw new ApiError('Invalid refresh token', 401);
    }
    return { accessToken: mockAccessToken, refreshToken: mockRefreshToken };
  }

  async getOffers(accessToken?: string) {
    return this.hasMemberAccess(accessToken)
      ? this.offers.map((offer) => ({ ...offer }))
      : this.offers.map(toGuestOffer);
  }

  async getOffer(id: string, accessToken?: string) {
    const offer = this.offers.find((candidate) => candidate.id === id);
    if (!offer) {
      throw new ApiError('Offer not found', 404);
    }
    return this.hasMemberAccess(accessToken)
      ? { ...offer }
      : toGuestOffer(offer);
  }

  async getMe(accessToken: string): Promise<User> {
    return { ...this.requireUser(accessToken) };
  }

  async updateMe(
    accessToken: string,
    update: ProfileUpdate,
  ): Promise<ProfileResult> {
    const user = this.requireUser(accessToken);
    const { currentPassword, newPassword, ...profileUpdate } = update;
    if (newPassword !== undefined) {
      if (currentPassword !== this.passwords.get(user.username)) {
        throw new ApiError('current_password_incorrect', 400);
      }
      if (!validatePassword(newPassword)) {
        throw new ApiError('invalid_password', 400);
      }
    }
    const updatedUser = { ...user, ...profileUpdate };
    const clash = this.users.find(
      (candidate) =>
        candidate.username !== user.username &&
        (candidate.username === updatedUser.username ||
          candidate.email === updatedUser.email),
    );
    if (clash) {
      throw new ApiError(
        clash.username === updatedUser.username
          ? 'Username already exists'
          : 'Email already exists',
        409,
      );
    }
    if (newPassword !== undefined) {
      this.passwords.delete(user.username);
      this.passwords.set(updatedUser.username, newPassword);
    } else if (updatedUser.username !== user.username) {
      this.passwords.set(
        updatedUser.username,
        this.passwords.get(user.username) ?? '',
      );
      this.passwords.delete(user.username);
    }
    this.user = updatedUser;
    const userIndex = this.users.findIndex(
      (candidate) => candidate.username === user.username,
    );
    if (userIndex >= 0) {
      this.users[userIndex] = updatedUser;
    }
    return {
      user: { ...this.user },
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
    };
  }

  async deleteMe(accessToken: string): Promise<void> {
    const user = this.requireUser(accessToken);
    this.users.splice(
      this.users.findIndex((candidate) => candidate.username === user.username),
      1,
    );
    this.user = null;
    this.passwords.delete(user.username);
    this.favoriteOfferIds.clear();
  }

  async getFavorites(accessToken: string): Promise<string[]> {
    this.requireUser(accessToken);
    return [...this.favoriteOfferIds];
  }

  async addFavorite(accessToken: string, offerId: string): Promise<void> {
    this.requireUser(accessToken);
    this.favoriteOfferIds.add(offerId);
  }

  async removeFavorite(accessToken: string, offerId: string): Promise<void> {
    this.requireUser(accessToken);
    this.favoriteOfferIds.delete(offerId);
  }

  async createOffer(
    accessToken: string,
    input: CreateOfferInput,
  ): Promise<Offer> {
    this.requireAdmin(accessToken);
    const offer = { ...input, id: `mock-${this.offers.length + 1}` };
    this.offers.push(offer);
    return { ...offer };
  }

  async updateOffer(
    accessToken: string,
    id: string,
    update: UpdateOfferInput,
  ): Promise<Offer> {
    this.requireAdmin(accessToken);
    const index = this.offers.findIndex((offer) => offer.id === id);
    if (index < 0) {
      throw new ApiError('Offer not found', 404);
    }
    this.offers[index] = { ...this.offers[index], ...update };
    return { ...this.offers[index] };
  }

  async deleteOffer(accessToken: string, id: string): Promise<void> {
    this.requireAdmin(accessToken);
    const index = this.offers.findIndex((offer) => offer.id === id);
    if (index < 0) {
      throw new ApiError('Offer not found', 404);
    }
    this.offers.splice(index, 1);
    this.favoriteOfferIds.delete(id);
  }

  async signUpload(
    _accessToken: string,
    input: UploadSignInput,
  ): Promise<UploadSignature> {
    this.requireAdmin(_accessToken);
    const fileName = encodeURIComponent(input.fileName);
    return {
      uploadUrl: `https://uploads.example.invalid/${fileName}`,
      imageUrl: `https://images.example.invalid/${fileName}`,
    };
  }

  async importOffers(
    _accessToken: string,
    _csv: string,
  ): Promise<CsvImportResult> {
    this.requireAdmin(_accessToken);
    throw new ApiError('CSV import mock is not implemented', 501);
  }

  async getUsers(accessToken: string): Promise<User[]> {
    this.requireAdmin(accessToken);
    return this.users.map((user) => ({ ...user }));
  }

  async createUser(accessToken: string, input: CreateUserInput): Promise<User> {
    this.requireAdmin(accessToken);
    const { password: _password, ...userInput } = input;
    if (this.users.some((user) => user.username === userInput.username)) {
      throw new ApiError('Username already exists', 409);
    }
    const user: User = { ...userInput, isActive: userInput.isActive ?? true };
    this.users.push(user);
    return { ...user };
  }

  async updateUser(
    accessToken: string,
    username: string,
    update: UpdateUserInput,
  ): Promise<User> {
    this.requireAdmin(accessToken);
    const index = this.users.findIndex((user) => user.username === username);
    if (index < 0) {
      throw new ApiError('User not found', 404);
    }
    const { password: _password, ...userUpdate } = update;
    if (
      this.users.some(
        (candidate) =>
          candidate.username !== username &&
          (candidate.username === userUpdate.username ||
            candidate.email === userUpdate.email),
      )
    ) {
      throw new ApiError('Username or email already exists', 409);
    }
    this.users[index] = { ...this.users[index], ...userUpdate };
    return { ...this.users[index] };
  }

  async deleteUser(accessToken: string, username: string): Promise<void> {
    this.requireAdmin(accessToken);
    const index = this.users.findIndex((user) => user.username === username);
    if (index < 0) {
      throw new ApiError('User not found', 404);
    }
    this.users.splice(index, 1);
    if (this.user?.username === username) {
      this.user = null;
      this.favoriteOfferIds.clear();
    }
  }

  private requireUser(accessToken: string): User {
    if (accessToken !== mockAccessToken || this.user === null) {
      throw new ApiError('Authentication required', 401);
    }
    return this.user;
  }

  private hasMemberAccess(accessToken: string | undefined): boolean {
    return (
      accessToken === mockAccessToken &&
      this.user !== null &&
      this.user.isActive
    );
  }

  private requireAdmin(accessToken: string): void {
    if (!this.requireUser(accessToken).isAdmin) {
      throw new ApiError('Administrator access required', 403);
    }
  }
}

export const mockApiClient: ApiClient = new MockApiClient();
