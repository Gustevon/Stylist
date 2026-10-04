export type Section = "inicio" | "closet" | "looks" | "feed" | "perfil";

export type WardrobeItem = {
  id: string;
  name: string;
  category: string;
  type: string;
  color: string;
  imageUrl: string;
  createdAt: number;
};

export type Outfit = {
  id: string;
  name: string;
  itemIds: string[];
  favorite: boolean;
  createdAt: number;
};

export type UserProfile = {
  name: string;
  email: string;
  height: string;
  weight: string;
  stylePreferences: string;
};

export type CommunityPost = {
  id: string;
  ownerId: string;
  author: string;
  handle: string;
  avatar: string;
  imageUrl: string;
  caption: string;
  likes: string[];
  commentsCount: number;
  createdAt: number;
};
