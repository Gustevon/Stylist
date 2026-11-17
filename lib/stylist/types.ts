export type Section = "inicio" | "closet" | "looks" | "feed" | "perfil";

export type WardrobeItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  style: string;
  imageUrl: string;
  createdAt: number;
};

export type Outfit = {
  id: string;
  name: string;
  occasion: string;
  itemIds: string[];
  favorite: boolean;
  createdAt: number;
};

export type UserProfile = {
  name: string;
  email: string;
  bio: string;
  photoURL: string;
  createdAt?: number;
  stylePreferences: string;
  colorPalette: string;
};

export type OutfitPiece = Pick<WardrobeItem, "id" | "name" | "category" | "color" | "style" | "imageUrl">;

export type CommunityComment = {
  id: string;
  uid: string;
  author: string;
  avatar: string;
  text: string;
  createdAt: number;
};

export type CommunityPost = {
  id: string;
  ownerId: string;
  author: string;
  handle: string;
  avatarUrl: string;
  occasion: string;
  items: OutfitPiece[];
  caption: string;
  likes: string[];
  commentsCount: number;
  createdAt: number;
};
