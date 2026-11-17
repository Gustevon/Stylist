import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CommunityComment, CommunityPost, Outfit, UserProfile, WardrobeItem } from "./types";

const maxImageDataUrlLength = 150 * 1024;
const maxCommunityPostBytes = 850 * 1024;

function database() {
  if (!db) throw new Error("O Firebase não está configurado neste ambiente.");
  return db;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Não foi possível converter a imagem otimizada."));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem otimizada."));
    reader.readAsDataURL(blob);
  });
}

export async function optimizeImageAsDataUrl(
  file: File,
  onProgress?: (progress: { phase: "processing"; percent: number }) => void,
) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem nos formatos JPG, PNG ou WebP.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");

  onProgress?.({ phase: "processing", percent: 5 });
  const image = new Image();
  const previewUrl = URL.createObjectURL(file);
  image.src = previewUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(previewUrl);
    throw new Error("Não foi possível abrir esta imagem. Tente outro arquivo.");
  }

  onProgress?.({ phase: "processing", percent: 20 });
  const maxDimension = 1200;
  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;
  const minimumScale = Math.min(1, 360 / Math.max(originalWidth, originalHeight));
  let scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
  let quality = 0.78;
  const canvas = document.createElement("canvas");
  URL.revokeObjectURL(previewUrl);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedImage = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a imagem.")),
        "image/webp",
        quality,
      );
    });
    const mimeType = compressedImage.type || "image/png";
    const dataUrlLength = `data:${mimeType};base64,`.length + 4 * Math.ceil(compressedImage.size / 3);
    if (dataUrlLength <= maxImageDataUrlLength) {
      const dataUrl = await blobToDataUrl(compressedImage);
      if (dataUrl.length <= maxImageDataUrlLength) {
        onProgress?.({ phase: "processing", percent: 95 });
        return dataUrl;
      }
    }

    onProgress?.({ phase: "processing", percent: Math.min(90, 30 + attempt * 7) });
    if (scale > minimumScale) {
      const shrinkFactor = Math.max(0.55, Math.min(0.9, Math.sqrt(maxImageDataUrlLength / dataUrlLength) * 0.9));
      scale = Math.max(minimumScale, scale * shrinkFactor);
    } else {
      quality = Math.max(0.4, quality - 0.08);
    }
  }

  throw new Error("A foto ficou grande mesmo após a otimização. Escolha outra imagem.");
}

export function watchItems(uid: string, onItems: (items: WardrobeItem[]) => void, onError: (error: Error) => void): Unsubscribe {
  const ref = collection(database(), "users", uid, "clothes");
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

export function watchMyPostInteractions(uid: string, onCount: (count: number) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(database(), "community_posts"), where("ownerId", "==", uid)), (snapshot) => {
    onCount(snapshot.docs.reduce((total, entry) => {
      const post = entry.data();
      const likes = Array.isArray(post.likes) ? post.likes.length : 0;
      const comments = typeof post.commentsCount === "number" ? post.commentsCount : 0;
      return total + likes + comments;
    }, 0));
  }, onError);
}

export function watchProfile(uid: string, onProfile: (profile: Partial<UserProfile>) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(database(), "users", uid), (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (Object.prototype.hasOwnProperty.call(data, "height") || Object.prototype.hasOwnProperty.call(data, "weight")) {
      void updateDoc(doc(database(), "users", uid), { height: deleteField(), weight: deleteField() }).catch((error: unknown) => {
        onError(error instanceof Error ? error : new Error("Não foi possível remover campos antigos do perfil."));
      });
    }
    onProfile({
      name: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
      bio: typeof data.bio === "string" ? data.bio : "",
      photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
      ...(typeof data.createdAt === "number" ? { createdAt: data.createdAt } : {}),
      stylePreferences: typeof data.stylePreferences === "string" ? data.stylePreferences : "",
      colorPalette: typeof data.colorPalette === "string" ? data.colorPalette : "",
    });
  }, onError);
}

export function watchFeed(onPosts: (posts: CommunityPost[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(database(), "community_posts"), orderBy("createdAt", "desc")), (snapshot) => {
    onPosts(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as CommunityPost));
  }, onError);
}

export function watchComments(postId: string, onComments: (comments: CommunityComment[]) => void, onError: (error: Error) => void): Unsubscribe {
  const comments = collection(database(), "community_posts", postId, "comments");
  return onSnapshot(query(comments, orderBy("createdAt", "asc")), (snapshot) => {
    onComments(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as CommunityComment));
  }, onError);
}

export async function saveProfile(uid: string, profile: UserProfile) {
  await setDoc(doc(database(), "users", uid), profile);
}

export async function saveItem(uid: string, item: WardrobeItem) {
  const { id, ...data } = item;
  if (data.imageUrl.startsWith("data:") && data.imageUrl.length > maxImageDataUrlLength) {
    throw new Error("A foto otimizada excede o limite seguro para salvar no Firestore.");
  }
  const ref = collection(database(), "users", uid, "clothes");
  try {
    await setDoc(doc(ref, id), data);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "";
    const messages: Record<string, string> = {
      "permission-denied": "O Firestore recusou a gravação. Publique firestore.rules no Firebase e confira sua sessão.",
      "firestore/permission-denied": "O Firestore recusou a gravação. Confira as regras de acesso e entre novamente.",
      "unauthenticated": "Sua sessão expirou. Entre novamente para salvar a peça.",
      "firestore/unauthenticated": "Sua sessão expirou. Entre novamente para salvar a peça.",
      "unavailable": "O Firestore está indisponível. Verifique sua conexão e tente novamente.",
      "firestore/unavailable": "O Firestore está indisponível. Verifique sua conexão e tente novamente.",
      "resource-exhausted": "O limite de gravações do Firestore foi atingido.",
      "firestore/resource-exhausted": "O limite de gravações do Firestore foi atingido.",
    };
    throw new Error(messages[code] ?? (error instanceof Error ? error.message : "Não foi possível salvar a peça no Firestore."));
  }
}

export async function removeItem(uid: string, item: WardrobeItem) {
  const outfits = collection(database(), "users", uid, "outfits");
  const referencingOutfits = await getDocs(query(outfits, where("itemIds", "array-contains", item.id)));
  const batch = writeBatch(database());
  batch.delete(doc(database(), "users", uid, "clothes", item.id));
  referencingOutfits.docs.forEach((outfit) => {
    batch.update(outfit.ref, { itemIds: arrayRemove(item.id) });
  });
  await batch.commit();
}

export async function saveOutfit(uid: string, outfit: Outfit) {
  const { id, ...data } = outfit;
  await setDoc(doc(database(), "users", uid, "outfits", id), data, { merge: true });
}

export async function removeOutfit(uid: string, outfitId: string) {
  await deleteDoc(doc(database(), "users", uid, "outfits", outfitId));
}

export async function savePost(post: Omit<CommunityPost, "id">) {
  const postSize = new TextEncoder().encode(JSON.stringify(post)).byteLength;
  if (postSize > maxCommunityPostBytes) {
    throw new Error("Este look tem muitas fotos para uma publicação. Compartilhe um look com menos peças.");
  }
  await addDoc(collection(database(), "community_posts"), post);
}

export async function toggleLike(postId: string, uid: string, liked: boolean) {
  await updateDoc(doc(database(), "community_posts", postId), {
    likes: liked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function addComment(postId: string, uid: string, author: string, avatar: string, text: string) {
  const postRef = doc(database(), "community_posts", postId);
  const commentRef = doc(collection(postRef, "comments"));
  await runTransaction(database(), async (transaction) => {
    const post = await transaction.get(postRef);
    if (!post.exists()) throw new Error("Esta publicação não está mais disponível.");
    transaction.set(commentRef, { uid, author, avatar, text, createdAt: Date.now() });
    transaction.update(postRef, {
      commentsCount: (post.data().commentsCount ?? 0) + 1,
      lastCommentId: commentRef.id,
    });
  });
}
