import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import type { CommunityPost, Outfit, UserProfile, WardrobeItem } from "./types";

function database() {
  if (!db) throw new Error("O Firebase não está configurado neste ambiente.");
  return db;
}

function fileStorage() {
  if (!storage) throw new Error("Configure NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET para enviar imagens.");
  return storage;
}

export async function uploadUserImage(uid: string, kind: "items" | "profile", key: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");

  const imagePath = `users/${uid}/${kind}/${key}`;
  const imageRef = ref(fileStorage(), imagePath);
  await uploadBytes(imageRef, file, { contentType: file.type });
  return { imageUrl: await getDownloadURL(imageRef), imagePath };
}

export function watchItems(uid: string, onItems: (items: WardrobeItem[]) => void, onError: (error: Error) => void): Unsubscribe {
  const ref = collection(database(), "users", uid, "items");
  return onSnapshot(query(ref, orderBy("createdAt", "desc")), (snapshot) => {
    onItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as WardrobeItem));
  }, onError);
}

export function watchOutfits(uid: string, onOutfits: (outfits: Outfit[]) => void, onError: (error: Error) => void): Unsubscribe {
  const ref = collection(database(), "users", uid, "outfits");
  return onSnapshot(query(ref, orderBy("createdAt", "desc")), (snapshot) => {
    onOutfits(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Outfit));
  }, onError);
}

export function watchProfile(uid: string, onProfile: (profile: Partial<UserProfile>) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(database(), "users", uid), (snapshot) => {
    if (snapshot.exists()) onProfile(snapshot.data() as Partial<UserProfile>);
  }, onError);
}

export function watchFeed(onPosts: (posts: CommunityPost[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(database(), "posts"), orderBy("createdAt", "desc")), (snapshot) => {
    onPosts(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as CommunityPost));
  }, onError);
}

export async function saveProfile(uid: string, profile: UserProfile) {
  await setDoc(doc(database(), "users", uid), profile, { merge: true });
}

export async function saveItem(uid: string, item: WardrobeItem) {
  const { id, ...data } = item;
  const ref = collection(database(), "users", uid, "items");
  return setDoc(doc(ref, id), data, { merge: true });
}

export async function removeItem(uid: string, itemId: string) {
  await deleteDoc(doc(database(), "users", uid, "items", itemId));
}

export async function saveOutfit(uid: string, outfit: Outfit) {
  const { id, ...data } = outfit;
  await setDoc(doc(database(), "users", uid, "outfits", id), data, { merge: true });
}

export async function savePost(post: Omit<CommunityPost, "id">) {
  await addDoc(collection(database(), "posts"), post);
}

export async function toggleLike(postId: string, uid: string, liked: boolean) {
  await updateDoc(doc(database(), "posts", postId), {
    likes: liked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function addComment(postId: string, uid: string, author: string, text: string) {
  const postRef = doc(database(), "posts", postId);
  const commentRef = doc(collection(postRef, "comments"));
  await setDoc(commentRef, { uid, author, text, createdAt: Date.now() });
  await updateDoc(postRef, { commentsCount: increment(1) });
}
