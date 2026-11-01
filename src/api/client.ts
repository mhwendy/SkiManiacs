import type { GuestOffer } from '@/domain/offers';
import type { Offer, User } from '@/domain/types';

export type OfferResponse = GuestOffer | Offer;

export type LoginInput = {
  username: string;
  password: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type ProfileUpdate = Partial<
  Pick<User, 'username' | 'name' | 'surname' | 'email'>
> & {
  currentPassword?: string;
  newPassword?: string;
};

// Tokens are returned because they are bound to the username, which a profile update can change.
export type ProfileResult = AuthResponse;

export type CreateOfferInput = Omit<Offer, 'id'>;
export type UpdateOfferInput = Partial<Omit<Offer, 'id'>>;
export type CreateUserInput = Omit<User, 'isActive'> & {
  isActive?: boolean;
  password: string;
};
export type UpdateUserInput = Partial<
  Pick<User, 'username' | 'name' | 'surname' | 'email' | 'isAdmin' | 'isActive'>
> & {
  password?: string;
};
export type UploadSignInput = {
  fileName: string;
  contentType: string;
};
export type UploadSignature = {
  uploadUrl: string;
  imageUrl: string;
};
export type CsvImportResult = {
  created: number;
  updated: number;
  errors: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  login(input: LoginInput): Promise<AuthResponse>;
  refresh(
    refreshToken: string,
  ): Promise<Pick<AuthResponse, 'accessToken' | 'refreshToken'>>;
  getOffers(accessToken?: string): Promise<OfferResponse[]>;
  getOffer(id: string, accessToken?: string): Promise<OfferResponse>;
  getMe(accessToken: string): Promise<User>;
  updateMe(accessToken: string, update: ProfileUpdate): Promise<ProfileResult>;
  deleteMe(accessToken: string): Promise<void>;
  getFavorites(accessToken: string): Promise<string[]>;
  addFavorite(accessToken: string, offerId: string): Promise<void>;
  removeFavorite(accessToken: string, offerId: string): Promise<void>;
  createOffer(accessToken: string, offer: CreateOfferInput): Promise<Offer>;
  updateOffer(
    accessToken: string,
    id: string,
    update: UpdateOfferInput,
  ): Promise<Offer>;
  deleteOffer(accessToken: string, id: string): Promise<void>;
  signUpload(
    accessToken: string,
    input: UploadSignInput,
  ): Promise<UploadSignature>;
  importOffers(accessToken: string, csv: string): Promise<CsvImportResult>;
  getUsers(accessToken: string): Promise<User[]>;
  createUser(accessToken: string, input: CreateUserInput): Promise<User>;
  updateUser(
    accessToken: string,
    username: string,
    update: UpdateUserInput,
  ): Promise<User>;
  deleteUser(accessToken: string, username: string): Promise<void>;
}
