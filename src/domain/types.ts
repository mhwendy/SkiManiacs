export type Language = 'sr' | 'en';

export type Offer = {
  id: string;
  title_sr: string;
  title_en: string | null;
  description_sr: string | null;
  description_en: string | null;
  category_sr: string | null;
  category_en: string | null;
  location_sr: string | null;
  location_en: string | null;
  price: string | null;
  priceAmount: number | null;
  currency: 'EUR' | 'RSD' | null;
  isPriceComingSoon: boolean;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  imageUrl3: string | null;
  imageUrl4: string | null;
  imageUrl5: string | null;
  availablePlaces: string | null;
  applicationDeadline: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
};

export type User = {
  username: string;
  name?: string;
  surname?: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
};

export type Favorite = {
  userId: string;
  offerId: string;
};

export type OfferFilter = {
  fromDate?: string | null;
  toDate?: string | null;
  categories?: readonly string[];
  locations?: readonly string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  availableOnly?: boolean;
  favoritesOnly?: boolean;
};
