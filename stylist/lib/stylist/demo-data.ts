import type { CommunityPost, Outfit, UserProfile, WardrobeItem } from "./types";

export const demoProfile: UserProfile = {
  name: "Marina Costa",
  email: "marina@email.com",
  height: "1,68",
  weight: "58",
  stylePreferences: "Minimalista, peças naturais e tons terrosos",
};

export const demoItems: WardrobeItem[] = [
  { id: "item-1", name: "Camisa de linho", category: "Roupas", type: "Blusas", color: "Areia", imageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=720&q=85", createdAt: 1 },
  { id: "item-2", name: "Calça reta", category: "Roupas", type: "Calças", color: "Oliva", imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=720&q=85", createdAt: 2 },
  { id: "item-3", name: "Trench clássico", category: "Roupas", type: "Casacos", color: "Caramelo", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=720&q=85", createdAt: 3 },
  { id: "item-4", name: "Bolsa tiracolo", category: "Acessórios", type: "Bolsas", color: "Chocolate", imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=720&q=85", createdAt: 4 },
  { id: "item-5", name: "Tênis retrô", category: "Calçados", type: "Tênis", color: "Off-white", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=720&q=85", createdAt: 5 },
  { id: "item-6", name: "Vestido midi", category: "Roupas", type: "Vestidos", color: "Terracota", imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=720&q=85", createdAt: 6 },
];

export const demoOutfits: Outfit[] = [
  { id: "look-1", name: "Sábado sem pressa", itemIds: ["item-1", "item-2", "item-4"], favorite: true, createdAt: 1 },
  { id: "look-2", name: "Cidade, 18h", itemIds: ["item-3", "item-5"], favorite: false, createdAt: 2 },
];

export const demoPosts: CommunityPost[] = [
  { id: "post-1", ownerId: "demo-1", author: "Clara Mendes", handle: "claramendes", avatar: "CM", imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=90", caption: "O uniforme não oficial dos dias em que quero ir mais devagar. Linho, café e uma caminhada sem destino.", likes: ["demo-2", "demo-3", "demo-4", "demo-5", "demo-6", "demo-7"], commentsCount: 3, createdAt: 1 },
  { id: "post-2", ownerId: "demo-2", author: "Inês Ribeiro", handle: "inesribeiro", avatar: "IR", imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=90", caption: "Uma peça de segunda mão, três maneiras de usar. Hoje ela ganhou uma camisa emprestada.", likes: ["demo-1", "demo-3", "demo-4"], commentsCount: 8, createdAt: 2 },
];
