"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  Bookmark,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Heart,
  House,
  LoaderCircle,
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Shirt,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  addComment,
  optimizeImageAsDataUrl,
  removeItem,
  removeOutfit,
  saveItem,
  saveOutfit,
  savePost,
  saveProfile,
  toggleLike,
  watchComments,
  watchFeed,
  watchItems,
  watchMyPostInteractions,
  watchOutfits,
  watchProfile,
} from "@/lib/stylist/store";
import type { CommunityComment, CommunityPost, Outfit, OutfitPiece, Section, UserProfile, WardrobeItem } from "@/lib/stylist/types";

const navItems: { id: Section; label: string; icon: typeof House }[] = [
  { id: "inicio", label: "Visão geral", icon: House },
  { id: "closet", label: "Meu closet", icon: Shirt },
  { id: "looks", label: "Looks", icon: Sparkles },
  { id: "feed", label: "Comunidade", icon: Heart },
  { id: "perfil", label: "Meu perfil", icon: UserRound },
];

const itemCategories = ["Parte de cima", "Parte de baixo", "Calçados", "Peça única", "Acessórios"];
const categories = ["Todas", ...itemCategories];
const occasions = ["Casual", "Trabalho", "Esporte", "Festa", "Rolê", "Outro"];
const emptyDraft = { name: "", category: itemCategories[0], color: "", style: "Casual", imageUrl: "" };
const blankProfile: UserProfile = { name: "", email: "", bio: "", photoURL: "", stylePreferences: "", colorPalette: "" };
const heroImage = "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1400&q=90";

function uid(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function validateImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use uma imagem nos formatos JPG, PNG ou WebP.";
  }
  if (file.size > 10 * 1024 * 1024) return "A imagem deve ter no máximo 10 MB.";
  return "";
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-[#555d50]">
      {label}
      <input {...props} className={`h-11 w-full rounded-sm border border-[#dfded7] bg-white px-3 text-sm font-normal text-[#252b24] outline-none transition focus:border-[#58725f] focus:ring-2 focus:ring-[#58725f]/10 ${props.className ?? ""}`} />
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1d251f]/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="app-grain enter-view max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm bg-[#fbfaf7] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="font-display text-3xl text-[#29362c]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full text-[#697165] transition hover:bg-[#eeede6]"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function StylistWorkspace() {
  const authState = useAuth();
  return <StylistWorkspaceView key={authState.user?.uid ?? "signed-out"} authState={authState} />;
}

function StylistWorkspaceView({ authState }: { authState: ReturnType<typeof useAuth> }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser, loading: authReady, enabled: firebaseEnabled, login, register, logout, updateAccount, changeEmail, changePassword } = authState;
  const section = (pathname === "/" ? "inicio" : pathname.slice(1)) as Section;
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => currentUser
    ? { ...blankProfile, name: currentUser.displayName ?? "", email: currentUser.email ?? "", photoURL: currentUser.photoURL ?? "" }
    : blankProfile);
  const [interactionsCount, setInteractionsCount] = useState(0);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [lookModal, setLookModal] = useState(false);
  const [lookDraft, setLookDraft] = useState({ name: "", occasion: "Casual" });
  const [authModal, setAuthModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharingOutfitId, setSharingOutfitId] = useState("");
  const [itemDraft, setItemDraft] = useState(emptyDraft);
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [itemUploadProgress, setItemUploadProgress] = useState<{ phase: "processing" | "saving"; percent: number } | null>(null);
  const [itemError, setItemError] = useState("");
  const [authError, setAuthError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const reportError = () => {
      setNoticeType("error");
      setNotice("Não foi possível sincronizar com o Firestore. Confira as regras do projeto.");
    };
    const stopItems = watchItems(currentUser.uid, setItems, reportError);
    const stopOutfits = watchOutfits(currentUser.uid, setOutfits, reportError);
    const stopProfile = watchProfile(currentUser.uid, (saved) => setProfile((previous) => ({ ...previous, ...saved })), reportError);
    const stopPosts = watchFeed(setPosts, reportError);
    const stopInteractions = watchMyPostInteractions(currentUser.uid, setInteractionsCount, reportError);
    return () => { stopItems(); stopOutfits(); stopProfile(); stopPosts(); stopInteractions(); };
  }, [currentUser]);

  useEffect(() => {
    const previews = [profileImagePreview, itemImagePreview].filter((preview): preview is string => Boolean(preview));
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [profileImagePreview, itemImagePreview]);

  useEffect(() => {
    if (!commentsOpen || !currentUser) return;
    return watchComments(commentsOpen, setComments, () => {
      showNotice("Não foi possível carregar os comentários.", "error");
    });
  }, [commentsOpen, currentUser]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const displayName = currentUser
    ? currentUser.displayName || profile.name || currentUser.email?.split("@")[0] || "Stylist"
    : "Visitante";
  const profilePhoto = profileImagePreview || profile.photoURL || currentUser?.photoURL || "/default-avatar.svg";
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === "Todas" || item.category === categoryFilter;
    const matchesSearch = `${item.name} ${item.style} ${item.color}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    return matchesCategory && matchesSearch;
  });
  const favoriteCount = outfits.filter((outfit) => outfit.favorite).length;

  function showNotice(message: string, type: "success" | "error" = "success") {
    setNotice(message);
    setNoticeType(type);
  }

  function navigateToSection(nextSection: Section) {
    router.push(nextSection === "inicio" ? "/" : `/${nextSection}`);
  }

  function requireUser() {
    if (currentUser) return currentUser;
    setRegistering(false);
    setAuthModal(true);
    return null;
  }

  if (!navItems.some(({ id }) => id === section)) return null;

  function openItemEditor(item?: WardrobeItem) {
    if (!requireUser()) return;
    setEditingItem(item ?? null);
    setItemDraft(item ? {
      name: item.name,
      category: item.category,
      color: item.color,
      style: item.style,
      imageUrl: item.imageUrl,
    } : emptyDraft);
    setItemImage(null);
    setItemImagePreview(null);
    setItemError("");
    setItemModal(true);
  }

  function openLookCreator() {
    if (!requireUser()) return;
    setSelected([]);
    setLookDraft({ name: "", occasion: "Casual" });
    setLookModal(true);
  }

  function openShareModal(outfitId?: string) {
    if (!requireUser()) return;
    if (!outfits.length) {
      showNotice("Salve um look antes de compartilhá-lo.", "error");
      navigateToSection("looks");
      return;
    }
    setSharingOutfitId(outfitId ?? outfits[0].id);
    setSharing(true);
  }

  function toggleComments(postId: string) {
    setComments([]);
    setCommentsOpen((previous) => previous === postId ? null : postId);
  }

  function selectItemImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const error = validateImage(file);
    if (error) {
      setItemImage(null);
      setItemImagePreview(null);
      setItemError(error);
      event.target.value = "";
      return;
    }
    setItemImage(file);
    setItemImagePreview(URL.createObjectURL(file));
    setItemError("");
  }

  function selectProfileImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const error = validateImage(file);
    if (error) {
      setProfileImage(null);
      setProfileImagePreview(null);
      showNotice(error, "error");
      event.target.value = "";
      return;
    }
    setProfileImage(file);
    setProfileImagePreview(URL.createObjectURL(file));
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = requireUser();
    if (!user) return;
    if (!itemDraft.name.trim() || !itemDraft.color.trim() || !itemDraft.style.trim()) {
      setItemError("Preencha o nome, a cor e o estilo da peça.");
      return;
    }
    if (!editingItem && !itemImage) {
      setItemError("Selecione uma foto para adicionar a peça.");
      return;
    }
    setItemError("");
    const itemId = editingItem?.id ?? uid("item");
    setPendingAction("item");
    try {
      let imageUrl = itemDraft.imageUrl;
      if (itemImage) {
        imageUrl = await optimizeImageAsDataUrl(itemImage, setItemUploadProgress);
      }

      const item: WardrobeItem = {
        id: itemId,
        name: itemDraft.name.trim(),
        category: itemDraft.category,
        color: itemDraft.color.trim(),
        style: itemDraft.style.trim(),
        imageUrl,
        createdAt: editingItem?.createdAt ?? Date.now(),
      };
      setItemUploadProgress({ phase: "saving", percent: 100 });
      await saveItem(user.uid, item);
      setItemModal(false);
      setItemImage(null);
      setItemImagePreview(null);
      showNotice(editingItem ? "Peça atualizada com sucesso." : "Peça adicionada com sucesso.");
    } catch (error) {
      setItemError(error instanceof Error ? error.message : "Não foi possível salvar a peça. Tente novamente.");
    } finally {
      setPendingAction(null);
      setItemUploadProgress(null);
    }
  }

  async function deleteWardrobeItem(item: WardrobeItem) {
    const user = requireUser();
    if (!user) return;
    if (!window.confirm(`Remover “${item.name}” do closet?`)) return;
    try {
      await removeItem(user.uid, item);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível remover a peça.", "error");
      return;
    }
    setSelected((previous) => previous.filter((id) => id !== item.id));
    showNotice("Peça removida do closet.");
  }

  async function createOutfit() {
    const user = requireUser();
    if (!user) return;
    if (!selected.length || !lookDraft.name.trim()) {
      showNotice("Informe um nome e selecione ao menos uma peça para o look.", "error");
      return;
    }
    const outfit: Outfit = {
      id: uid("look"),
      name: lookDraft.name.trim(),
      occasion: lookDraft.occasion,
      itemIds: selected,
      favorite: false,
      createdAt: Date.now(),
    };
    setPendingAction("look");
    try {
      await saveOutfit(user.uid, outfit);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar o look.", "error");
      return;
    } finally {
      setPendingAction(null);
    }
    setSelected([]);
    setLookModal(false);
    navigateToSection("looks");
    showNotice("Look salvo com sucesso.");
  }

  async function toggleFavorite(outfit: Outfit) {
    const user = requireUser();
    if (!user) return;
    const updated = { ...outfit, favorite: !outfit.favorite };
    try {
      await saveOutfit(user.uid, updated);
      showNotice(updated.favorite ? "Look adicionado aos favoritos." : "Look removido dos favoritos.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível atualizar o favorito.", "error");
    }
  }

  async function deleteOutfit(outfit: Outfit) {
    const user = requireUser();
    if (!user) return;
    if (!window.confirm(`Excluir o look “${outfit.name}”?`)) return;
    try {
      await removeOutfit(user.uid, outfit.id);
      showNotice("Look excluído.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível excluir o look.", "error");
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = requireUser();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newEmail = String(form.get("newEmail") ?? "").trim();
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const emailChanged = Boolean(newEmail && newEmail.toLowerCase() !== user.email?.toLowerCase());
    if ((emailChanged || newPassword) && !currentPassword) {
      showNotice("Informe sua senha atual para alterar os dados da conta.", "error");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showNotice("A nova senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      showNotice("A confirmação da senha não confere.", "error");
      return;
    }
    setPendingAction("profile");
    try {
      let photoURL = profile.photoURL;
      if (profileImage) {
        photoURL = await optimizeImageAsDataUrl(profileImage);
      }
      const updatedProfile = {
        ...profile,
        name: profile.name.trim(),
        email: emailChanged ? newEmail : user.email ?? profile.email,
        photoURL,
      };
      if (emailChanged) await changeEmail(currentPassword, newEmail);
      await updateAccount(updatedProfile.name);
      await saveProfile(user.uid, updatedProfile);
      if (newPassword) await changePassword(currentPassword, newPassword);
      setProfile(updatedProfile);
      setProfileImage(null);
      setProfileImagePreview(null);
      showNotice("Perfil atualizado.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar seu perfil.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    try {
      if (registering) {
        await register(name, email, password);
      } else await login(email, password);
      setAuthModal(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível entrar. Confira seus dados.");
    } finally { setBusy(false); }
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = requireUser();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const caption = String(form.get("caption") ?? "").trim();
    const outfit = outfits.find((entry) => entry.id === sharingOutfitId);
    if (!outfit) {
      showNotice("Selecione um look salvo para compartilhar.", "error");
      return;
    }
    const pieces: OutfitPiece[] = outfit.itemIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is WardrobeItem => Boolean(item))
      .map(({ id, name, category, color, style, imageUrl }) => ({ id, name, category, color, style, imageUrl }));
    if (!pieces.length) {
      showNotice("Esse look não tem peças disponíveis para compartilhar.", "error");
      return;
    }
    const post: Omit<CommunityPost, "id"> = {
      ownerId: user.uid,
      author: displayName,
      handle: user.email?.split("@")[0] ?? "",
      avatarUrl: profilePhoto,
      occasion: outfit.occasion,
      items: pieces,
      caption,
      likes: [],
      commentsCount: 0,
      createdAt: Date.now(),
    };
    setPendingAction("post");
    try {
      await savePost(post);
      setSharing(false);
      setSharingOutfitId("");
      navigateToSection("feed");
      showNotice("Publicado na comunidade.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível publicar o look.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function likePost(post: CommunityPost) {
    const user = requireUser();
    if (!user) return;
    const liked = post.likes.includes(user.uid);
    try {
      await toggleLike(post.id, user.uid, liked);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível atualizar a curtida.", "error");
    }
  }

  async function commentOnPost(event: FormEvent<HTMLFormElement>, post: CommunityPost) {
    event.preventDefault();
    const user = requireUser();
    if (!user) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = String(form.get("comment") ?? "").trim();
    if (!text) return;
    try {
      await addComment(post.id, user.uid, displayName, initials, text);
      formElement.reset();
      showNotice("Comentário enviado.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível enviar o comentário.", "error");
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível sair da conta.", "error");
    }
  }

  function ImageTile({ item, selectable = false }: { item: WardrobeItem; selectable?: boolean }) {
    const isSelected = selected.includes(item.id);
    const toggleSelection = () => setSelected((previous) => isSelected ? previous.filter((id) => id !== item.id) : [...previous, item.id]);
    return (
      <article className={`group min-w-0 ${selectable && isSelected ? "ring-2 ring-[#58725f] ring-offset-2 ring-offset-[#f5f3ed]" : ""}`}>
        <button type="button" onClick={selectable ? toggleSelection : () => openItemEditor(item)} className="relative block aspect-[4/5] w-full overflow-hidden bg-[#e7e4db] text-left" aria-label={selectable ? `${isSelected ? "Desmarcar" : "Selecionar"} ${item.name}` : `Editar ${item.name}`}>
          {itemImagePreview && editingItem?.id === item.id ? <Image src={itemImagePreview} alt={item.name} fill unoptimized sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" /> : item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" /> : <span className="absolute inset-0 grid place-items-center text-[#8b8c82]"><Shirt size={28} /></span>}
          {selectable ? <span className={`absolute right-3 top-3 grid size-6 place-items-center border ${isSelected ? "border-[#314c3c] bg-[#314c3c] text-white" : "border-white/80 bg-white/75 text-transparent"}`}><Check size={14} /></span> : null}
          {!selectable ? <span className="absolute bottom-3 left-3 bg-[#f7f5ef]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#354238]">{item.color}</span> : null}
        </button>
        <div className="flex items-start justify-between gap-2 pt-3">
          <button type="button" onClick={selectable ? toggleSelection : () => openItemEditor(item)} className="min-w-0 text-left">
            <span className="block truncate text-sm font-semibold text-[#343b32]">{item.name}</span>
            <span className="mt-1 block text-xs text-[#85887e]">{item.category} · {item.color}</span>
          </button>
          {!selectable ? <button type="button" title={`Remover ${item.name}`} aria-label={`Remover ${item.name}`} onClick={() => void deleteWardrobeItem(item)} className="grid size-8 shrink-0 place-items-center text-[#8b8c82] opacity-0 transition hover:text-[#b74e3d] group-hover:opacity-100 focus:opacity-100"><X size={15} /></button> : null}
        </div>
      </article>
    );
  }

  function OutfitCard({ outfit }: { outfit: Outfit }) {
    const pieces = outfit.itemIds.map((id) => items.find((item) => item.id === id)).filter((item): item is WardrobeItem => Boolean(item));
    return (
      <article className="border-b border-[#e3e1d9] pb-5">
        <div className="grid grid-cols-3 gap-2">
          {pieces.slice(0, 3).map((item) => <div key={item.id} className="relative aspect-[4/5] overflow-hidden bg-[#e7e4db]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 640px) 33vw, 20vw" className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-[#8b8c82]"><Shirt size={25} /></span>}</div>)}
          {pieces.length === 0 ? <div className="col-span-3 grid aspect-[4/2] place-items-center bg-[#e9e7df] text-sm text-[#777c70]">As peças desse look não estão mais no closet.</div> : null}
        </div>
        <div className="flex items-center justify-between gap-3 pt-4">
          <div className="min-w-0"><h3 className="truncate font-display text-xl text-[#313a30]">{outfit.name}</h3><p className="mt-1 text-xs text-[#888a80]">{outfit.occasion} · {pieces.length} peças</p></div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => openShareModal(outfit.id)} aria-label={`Compartilhar ${outfit.name}`} title="Compartilhar look" className="grid size-9 place-items-center rounded-full border border-[#dfded7] text-[#83867c] hover:text-[#4f6b54]"><ArrowRight size={15} /></button>
            <button type="button" onClick={() => void toggleFavorite(outfit)} aria-label={outfit.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} title={outfit.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} className={`grid size-9 place-items-center rounded-full border transition ${outfit.favorite ? "border-[#d7b2a6] bg-[#f7eae5] text-[#bd624b]" : "border-[#dfded7] text-[#83867c] hover:border-[#d7b2a6] hover:text-[#bd624b]"}`}><Heart size={16} fill={outfit.favorite ? "currentColor" : "none"} /></button>
            <button type="button" onClick={() => void deleteOutfit(outfit)} aria-label={`Excluir ${outfit.name}`} title="Excluir look" className="grid size-9 place-items-center rounded-full border border-[#dfded7] text-[#83867c] hover:text-[#b74e3d]"><Trash2 size={15} /></button>
          </div>
        </div>
      </article>
    );
  }

  const sectionTitle: Record<Section, { eyebrow: string; title: string; detail: string }> = {
    inicio: { eyebrow: "UM NOVO DIA, DO SEU JEITO", title: "Vista o que faz sentido.", detail: "Seu estilo já está aqui. Vamos encontrar novas combinações?" },
    closet: { eyebrow: "SEU ACERVO PESSOAL", title: "Meu closet", detail: `${items.length} peças para vestir os seus dias.` },
    looks: { eyebrow: "COMBINAÇÕES COM INTENÇÃO", title: "Looks salvos", detail: "Ideias prontas para os dias em que o armário parece cheio demais." },
    feed: { eyebrow: "ESTILO É TROCA", title: "Inspiração que circula.", detail: "Looks reais, ideias novas e gente que veste do seu jeito." },
    perfil: { eyebrow: "DO SEU JEITO", title: "Seu perfil", detail: "Suas referências, preferências de estilo e dados da conta." },
  };

  if (authReady) {
    return <main className="grid min-h-screen place-items-center bg-[#0A0A0A] px-4" aria-label="Carregando sua conta"><div className="w-full max-w-sm"><div className="mx-auto mb-5 size-8 animate-spin rounded-full border-2 border-[#24232b] border-t-[#c6ff3d]" /><div className="h-4 animate-pulse bg-[#15151a]" /><div className="mx-auto mt-3 h-3 w-2/3 animate-pulse bg-[#111216]" /></div></main>;
  }

  return (
    <div className="app-grain min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col border-r border-[#e1dfd7] bg-[#f8f7f2] px-6 py-7 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <button type="button" onClick={() => navigateToSection("inicio")} className="flex items-center gap-3 text-left" aria-label="Stylist, início">
          <span className="relative block h-[108px] w-[190px] bg-black"><Image src="/logo-stylist-complete.jpeg" alt="Stylist Your Wardrobe" fill priority sizes="190px" className="object-contain" /></span>
        </button>
        <div className="mb-3 mt-14 px-3 text-[9px] font-bold uppercase tracking-[0.19em] text-[#9b9b90]">Seu espaço</div>
        <nav className="grid gap-1" aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigateToSection(id)} aria-current={section === id ? "page" : undefined} className={`flex h-11 items-center gap-3 px-3 text-left text-[13px] transition ${section === id ? "bg-[#e7ebe4] font-semibold text-[#314c3c]" : "text-[#777c70] hover:bg-[#eeede7] hover:text-[#354238]"}`}><Icon size={17} strokeWidth={1.8} />{label}{id === "looks" ? <span className="ml-auto text-[11px] text-[#a1a298]">{outfits.length}</span> : null}</button>)}
        </nav>
        <div className="mt-auto border-t border-[#e5e3dc] pt-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e6d5c8] text-[11px] font-semibold text-[#6a5142]"><Image src={profilePhoto} alt="" fill unoptimized sizes="36px" className="object-cover" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#3a4037]">{displayName}</span><span className="mt-0.5 block truncate text-[10px] text-[#8d8e84]">{currentUser?.email ?? "Seu espaço pessoal"}</span></span>
            {currentUser ? <button type="button" title="Sair da conta" aria-label="Sair da conta" onClick={() => void handleLogout()} className="grid size-8 place-items-center text-[#85877d] hover:text-[#b74e3d]"><LogOut size={15} /></button> : null}
          </div>
          {!currentUser ? <button type="button" onClick={() => { setRegistering(false); setAuthModal(true); }} className="flex h-10 w-full items-center justify-center gap-2 border border-[#d9ded5] text-xs font-semibold text-[#46604c] transition hover:bg-[#eef1eb]"><LogIn size={15} />Entrar ou criar conta</button> : <span className="flex items-center gap-2 px-1 text-[10px] text-[#62806a]"><span className="size-1.5 rounded-full bg-[#749479]" />Conta sincronizada</span>}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[78px] items-center justify-between border-b border-[#e1dfd7] bg-[#f5f3ed]/95 px-4 backdrop-blur sm:px-8 lg:h-[66px] lg:px-12">
          <button type="button" onClick={() => navigateToSection("inicio")} className="flex items-center lg:hidden"><span className="relative block h-[74px] w-[130px] bg-black"><Image src="/logo-stylist-complete.jpeg" alt="Stylist Your Wardrobe" fill priority sizes="130px" className="object-contain" /></span></button>
          <div className="hidden items-center gap-2 text-xs text-[#96968c] lg:flex"><span>Seu espaço</span><span>/</span><span className="font-medium text-[#4b5349]">{navItems.find((item) => item.id === section)?.label}</span></div>
          <div className="ml-auto flex items-center gap-3">
            {!firebaseEnabled ? <span className="hidden items-center gap-1.5 border border-[#e4d9c3] bg-[#f5eddf] px-2.5 py-1.5 text-[10px] font-medium text-[#897047] sm:flex"><span className="size-1.5 rounded-full bg-[#c79b55]" />Firebase não configurado</span> : null}
            <button type="button" onClick={() => currentUser ? navigateToSection("perfil") : (setRegistering(false), setAuthModal(true))} className="flex items-center gap-2 text-left" title={currentUser ? currentUser.email ?? "Perfil" : "Entrar na conta"}><span className="relative grid size-8 place-items-center overflow-hidden rounded-full bg-[#e6d5c8] text-[10px] font-semibold text-[#6a5142]"><Image src={profilePhoto} alt="" fill unoptimized sizes="32px" className="object-cover" /></span><ChevronDown className="hidden text-[#85877d] sm:block" size={13} /></button>
          </div>
        </header>

        <nav className="sticky top-[78px] z-20 flex overflow-x-auto border-b border-[#e5e3dc] bg-[#f8f7f2] px-3 py-2 lg:hidden" aria-label="Navegação móvel">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigateToSection(id)} aria-current={section === id ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 px-3 text-xs ${section === id ? "border-b-2 border-[#48624d] font-semibold text-[#314c3c]" : "text-[#777c70]"}`}><Icon size={15} />{label}</button>)}
          {!currentUser ? <button type="button" onClick={() => { setRegistering(false); setAuthModal(true); }} className="ml-auto flex shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-[#48624d]"><LogIn size={15} />Entrar</button> : <button type="button" onClick={() => void handleLogout()} aria-label="Sair da conta" className="ml-auto grid size-10 shrink-0 place-items-center text-[#777c70]"><LogOut size={15} /></button>}
        </nav>

        <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
          <div key={section} className="enter-view">
            {section === "inicio" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
                <div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.inicio.eyebrow}</p><h1 className="font-display text-[38px] leading-[1.05] tracking-tight text-[#29362c] sm:text-[48px]">Vista o que faz sentido.</h1><p className="mt-3 max-w-lg text-sm text-[#7e8176]">Bom dia, {displayName.split(" ")[0]}. Seu estilo já está aqui. Vamos encontrar novas combinações?</p></div>
                <button type="button" onClick={() => openItemEditor()} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white transition hover:bg-[#253b2d]"><Plus size={16} />Adicionar peça</button>
              </div>
              <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  { label: "PEÇAS NO CLOSET", value: items.length, note: "no seu acervo", icon: Shirt },
                  { label: "LOOKS CRIADOS", value: outfits.length, note: "combinações salvas", icon: Sparkles },
                  { label: "LOOKS FAVORITOS", value: favoriteCount, note: "para repetir", icon: Heart },
                  { label: "INTERAÇÕES", value: interactionsCount, note: "nos seus looks", icon: ChartNoAxesColumnIncreasing },
                ].map(({ label, value, note, icon: Icon }, index) => <article key={label} className="border border-[#24232b] bg-[#101114] px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a8996]">{label}</span><Icon size={15} className={index % 2 === 0 ? "text-[#c6ff3d]" : "text-[#8a2be2]"} /></div><div className="mt-3 flex items-baseline justify-between gap-2"><span className="font-display text-[27px] leading-none text-white sm:text-[31px]">{value}</span><span className="text-right text-[9px] text-[#767580]">{note}</span></div></article>)}
              </section>
              <section className="hero-panel relative grid min-h-[290px] overflow-hidden sm:min-h-[340px] lg:grid-cols-[1fr_0.85fr]">
                <div className="relative z-10 flex flex-col items-start justify-center px-6 py-9 text-[#f6f1e8] sm:px-10 lg:px-12">
                  <span className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4d5c7]"><Sparkles size={13} />Um bom dia começa no espelho</span>
                  <h2 className="font-display max-w-md text-[36px] leading-[1.04] sm:text-[45px]">Menos peças.<br />Mais possibilidades.</h2>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-[#d0d5ca]">Você já tem {items.length} peças para criar algo novo hoje.</p>
                  <button type="button" onClick={openLookCreator} className="mt-7 flex h-11 items-center gap-3 border border-white/35 px-4 text-xs font-semibold text-white transition hover:bg-white/10">Montar um look <ArrowRight size={15} /></button>
                  <span className="absolute bottom-4 right-5 font-display text-[11px] italic text-white/50">seu estilo, em movimento</span>
                </div>
                <div className="absolute inset-y-0 right-0 -z-0 w-full sm:w-[58%] lg:relative lg:z-0 lg:w-full">
                  <Image src={heroImage} alt="Inspiração de look casual em tons naturais" fill unoptimized loading="eager" sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-[center_35%] opacity-35 mix-blend-luminosity sm:opacity-55 lg:opacity-90 lg:mix-blend-normal" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/70 to-transparent lg:bg-gradient-to-r lg:from-[#09090b]/40 lg:via-transparent lg:to-transparent" />
                  <div className="absolute bottom-7 right-7 hidden border border-white/40 bg-[#f5f3ed]/90 px-4 py-3 text-[#384337] sm:block lg:bottom-8 lg:right-8"><span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#85887c]">Seu armário</span><span className="mt-1 block font-display text-[28px] leading-none">{items.length}<span className="ml-1.5 text-sm">peças</span></span></div>
                </div>
              </section>
              <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
                <section>
                  <div className="mb-4 flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999a90]">BONS DE TER À MÃO</p><h2 className="mt-1 font-display text-[25px] text-[#333c32]">Peças recentes</h2></div><button type="button" onClick={() => navigateToSection("closet")} className="flex items-center gap-1 pb-1 text-xs font-semibold text-[#58705c]">Ver closet <ArrowRight size={13} /></button></div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">{items.slice(0, 3).map((item) => <ImageTile key={item.id} item={item} />)}</div>
                </section>
                <section className="border-t border-[#e3e1d9] pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                  <div className="mb-5 flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999a90]">SEU JEITO DE COMBINAR</p><h2 className="mt-1 font-display text-[25px] text-[#333c32]">Em destaque</h2></div><button type="button" onClick={() => navigateToSection("looks")} aria-label="Ver todos os looks" className="grid size-8 place-items-center rounded-full border border-[#dfded7] text-[#647061]"><ArrowDownRight size={15} /></button></div>
                  {outfits.slice(0, 2).map((outfit) => <div key={outfit.id} className="mb-3 flex items-center gap-3 border-b border-[#e7e5de] pb-3"><div className="flex -space-x-2">{outfit.itemIds.slice(0, 3).map((id) => { const item = items.find((entry) => entry.id === id); return <span key={id} className="relative grid size-10 place-items-center overflow-hidden rounded-full border-2 border-[#f5f3ed] bg-[#e7e4db]">{item?.imageUrl ? <Image src={item.imageUrl} alt="" fill unoptimized sizes="40px" className="object-cover" /> : <Shirt size={15} />}</span>; })}</div><div className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#42483f]">{outfit.name}</span><span className="mt-1 block text-[10px] text-[#94958b]">{outfit.itemIds.length} peças · {outfit.occasion}</span></div>{outfit.favorite ? <Heart size={15} className="text-[#bf705c]" fill="currentColor" /> : null}</div>)}
                  <p className="mt-5 flex items-center gap-2 text-[11px] text-[#888b80]"><Bookmark size={13} />{favoriteCount} looks favoritos</p>
                </section>
              </div>
              <section className="mt-10 border-t border-[#e3e1d9] pt-7"><div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999a90]">DA COMUNIDADE</p><h2 className="mt-1 font-display text-[25px] text-[#333c32]">Uma ideia para levar</h2></div><button type="button" onClick={() => navigateToSection("feed")} className="flex items-center gap-1 text-xs font-semibold text-[#58705c]">Abrir feed <ArrowRight size={13} /></button></div>{posts[0] ? <div className="flex items-center gap-4 border-y border-[#e4e2db] py-4"><span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[#e7e4db]">{posts[0].items[0]?.imageUrl ? <Image src={posts[0].items[0].imageUrl} alt="" fill unoptimized sizes="48px" className="object-cover" /> : <Shirt className="absolute inset-0 m-auto" size={18} />}</span><p className="min-w-0 flex-1 text-sm leading-6 text-[#656c61]">{posts[0].caption || `${posts[0].author} compartilhou um look para ${posts[0].occasion.toLowerCase()}.`}</p><span className="hidden text-xs font-semibold text-[#42483f] sm:block">{posts[0].author}</span></div> : <p className="border-y border-[#e4e2db] py-4 text-sm text-[#85877d]">Ainda não há publicações da comunidade.</p>}</section>
            </> : null}

            {section === "closet" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.closet.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Meu closet<span className="ml-2 align-top font-sans text-[13px] font-medium text-[#9b9b90]">{items.length}</span></h1><p className="mt-3 text-sm text-[#7e8176]">{sectionTitle.closet.detail}</p></div><button type="button" onClick={() => openItemEditor()} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d]"><Plus size={16} />Adicionar peça</button></div>
              <div className="mb-6 flex flex-col gap-4 border-y border-[#e2e0d8] py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-1 overflow-x-auto">{categories.map((category) => <button key={category} type="button" onClick={() => setCategoryFilter(category)} className={`shrink-0 px-3 py-2 text-xs transition ${categoryFilter === category ? "bg-[#314c3c] font-semibold text-white" : "text-[#777c70] hover:bg-[#e9e8e1]"}`}>{category}</button>)}</div><label className="flex h-10 items-center gap-2 border-b border-[#d9d8d0] px-2 text-[#8a8c82] sm:w-56"><Search size={15} /><input aria-label="Buscar peças" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no closet" className="min-w-0 flex-1 bg-transparent text-xs text-[#374037] outline-none placeholder:text-[#a1a196]" /></label></div>
              {filteredItems.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4">{filteredItems.map((item) => <ImageTile key={item.id} item={item} />)}</div> : <div className="grid min-h-56 place-items-center border border-dashed border-[#d8d7ce] text-center"><div><Shirt className="mx-auto text-[#92968b]" size={25} /><p className="mt-3 font-display text-xl text-[#384238]">Nada por aqui ainda.</p><p className="mt-1 text-xs text-[#888a80]">Experimente outra busca ou adicione uma peça.</p></div></div>}
            </> : null}

            {section === "looks" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.looks.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Looks salvos<span className="ml-2 align-top font-sans text-[13px] font-medium text-[#9b9b90]">{outfits.length}</span></h1><p className="mt-3 text-sm text-[#7e8176]">Suas combinações, prontas para qualquer ocasião.</p></div><button type="button" onClick={openLookCreator} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d]"><Plus size={16} />Montar um look</button></div>
              <div className="mb-4 flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999a90]">SUAS COMBINAÇÕES</p><h2 className="mt-1 font-display text-[26px] text-[#333c32]">Prontos para repetir</h2></div><span className="text-xs text-[#8b8d83]">{favoriteCount} favoritos</span></div>
              {outfits.length ? <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">{outfits.map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} />)}</div> : <p className="border-y border-[#e3e1d9] py-8 text-sm text-[#85877d]">Ainda não há looks salvos. Monte um look com as peças do seu closet.</p>}
            </> : null}

            {section === "feed" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.feed.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Inspiração que circula.</h1><p className="mt-3 text-sm text-[#7e8176]">{sectionTitle.feed.detail}</p></div><button type="button" onClick={() => openShareModal()} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d]"><Plus size={16} />Compartilhar look</button></div>
              {posts.length ? <div className="grid gap-7 lg:grid-cols-2">{posts.map((post) => {
                const liked = Boolean(currentUser && post.likes.includes(currentUser.uid));
                const formattedDate = new Date(post.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
                return <article key={post.id} className="min-w-0 border-y border-[#e1dfd7] py-4 sm:px-1">
                  <header className="mb-4 flex min-w-0 items-center gap-3">
                    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8ddd2] text-[9px] font-bold text-[#685344]">
                      <Image src={post.avatarUrl || "/default-avatar.svg"} alt="" fill unoptimized sizes="40px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#40483e]">{post.author}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-[#999a90]"><Clock3 size={11} />{formattedDate} · {post.occasion}</span></span>
                  </header>
                  <div className={`grid gap-2 ${post.items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {post.items.map((item) => <div key={item.id} className="min-w-0 overflow-hidden border border-[#24232b] bg-[#101114]">
                      <div className="relative aspect-[4/5] bg-[#19191e]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" /> : <Shirt className="absolute inset-0 m-auto text-[#8b8c82]" size={24} />}</div>
                      <div className="px-3 py-2"><span className="block truncate text-xs font-semibold text-[#f1f0f4]">{item.name}</span><span className="mt-1 block truncate text-[10px] text-[#8a8996]">{item.category} · {item.color}</span></div>
                    </div>)}
                  </div>
                  {post.caption ? <p className="mt-4 whitespace-pre-wrap text-xs leading-[1.8] text-[#a3a2ad]">{post.caption}</p> : null}
                  <div className="mt-4 flex items-center gap-5 border-t border-[#24232b] pt-3">
                    <button type="button" onClick={() => void likePost(post)} aria-label={liked ? "Descurtir publicação" : "Curtir publicação"} className={`flex items-center gap-1.5 text-xs ${liked ? "text-[#c36350]" : "text-[#82867c] hover:text-[#c36350]"}`}><Heart size={16} fill={liked ? "currentColor" : "none"} />{post.likes.length}</button>
                    <button type="button" onClick={() => toggleComments(post.id)} aria-expanded={commentsOpen === post.id} className="flex items-center gap-1.5 text-xs text-[#82867c] hover:text-[#4e6751]"><MessageCircle size={15} />{post.commentsCount} comentários</button>
                  </div>
                  {commentsOpen === post.id ? <div className="mt-3">
                    {comments.length ? <ul className="mb-3 grid max-h-40 gap-3 overflow-y-auto">{comments.map((comment) => <li key={comment.id} className="flex items-start gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#25202e] text-[9px] font-bold text-[#f1f0f4]">{comment.avatar}</span><p className="min-w-0 text-[11px] leading-5 text-[#a3a2ad]"><span className="mr-1 font-semibold text-[#f1f0f4]">{comment.author}</span>{comment.text}</p></li>)}</ul> : <p className="mb-3 text-[11px] text-[#85877d]">Ainda não há comentários.</p>}
                    <form onSubmit={(event) => void commentOnPost(event, post)} className="flex gap-2"><input name="comment" maxLength={240} required placeholder="Escreva um comentário" className="min-w-0 flex-1 border-b border-[#d7d8ce] bg-transparent py-2 text-[11px] outline-none placeholder:text-[#a2a397]" /><button type="submit" aria-label="Enviar comentário" className="text-[11px] font-semibold text-[#4f6b54]">Enviar</button></form>
                  </div> : null}
                </article>;
              })}</div> : <div className="grid min-h-56 place-items-center border border-dashed border-[#d8d7ce] text-center"><div><Heart className="mx-auto text-[#92968b]" size={25} /><p className="mt-3 font-display text-xl text-[#384238]">O feed está tranquilo por enquanto.</p><p className="mt-1 text-xs text-[#888a80]">Compartilhe um look para iniciar a conversa.</p></div></div>}
            </> : null}

            {section === "perfil" ? <>
              <div className="mb-8"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.perfil.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Seu perfil</h1><p className="mt-3 text-sm text-[#7e8176]">{sectionTitle.perfil.detail}</p></div>
              <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
                <section className="border-y border-[#e2e0d8] py-6"><div className="flex items-center gap-4"><span className="relative grid size-16 place-items-center overflow-hidden rounded-full bg-[#e6d5c8] font-display text-[22px] text-[#6a5142]"><Image src={profilePhoto} alt="" fill unoptimized sizes="64px" className="object-cover" /></span><div><h2 className="font-display text-[25px] text-[#333c32]">{displayName}</h2><p className="mt-1 text-xs text-[#8d8f84]">{currentUser?.email ?? profile.email}</p></div></div><div className="mt-4 text-sm leading-6 text-[#777c70]">{profile.bio || "Adicione uma bio para contar um pouco sobre seu estilo."}</div><div className="mt-7 grid grid-cols-2 gap-3"><div className="bg-[#eae9e2] p-4"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#929388]">Preferências</span><p className="mt-2 text-xs leading-5 text-[#384238]">{profile.stylePreferences || "Estilo ainda não informado."}</p></div><div className="bg-[#eae9e2] p-4"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#929388]">Paleta de cores</span><p className="mt-2 text-xs leading-5 text-[#384238]">{profile.colorPalette || "Paleta ainda não informada."}</p></div></div><div className="mt-5 flex justify-between border-b border-[#e3e1d9] py-3 text-xs"><span className="text-[#85877d]">Peças no closet</span><span className="font-semibold text-[#485146]">{items.length}</span></div><div className="flex justify-between border-b border-[#e3e1d9] py-3 text-xs"><span className="text-[#85877d]">Looks favoritos</span><span className="font-semibold text-[#485146]">{favoriteCount}</span></div></section>
                <form onSubmit={(event) => void submitProfile(event)} className="grid content-start gap-5 border-y border-[#e2e0d8] py-6"><div className="mb-1"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#999a90]">INFORMAÇÕES DA CONTA</p><h2 className="mt-1 font-display text-[26px] text-[#333c32]">Perfil e preferências</h2></div><Field label="Nome de exibição" required value={profile.name} onChange={(event) => setProfile((previous) => ({ ...previous, name: event.target.value }))} placeholder="Seu nome" /><Field label="E-mail atual" value={currentUser?.email ?? ""} readOnly /><Field label="Novo e-mail (opcional)" name="newEmail" type="email" autoComplete="email" placeholder="voce@email.com" /><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Foto de perfil<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!currentUser} onChange={selectProfileImage} className="w-full border border-[#dfded7] bg-white px-3 py-2 text-xs font-normal" />{profileImage ? <span className="text-[10px] font-normal text-[#929388]">{profileImage.name} · prévia aplicada</span> : null}</label><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Bio<textarea rows={3} maxLength={240} value={profile.bio} onChange={(event) => setProfile((previous) => ({ ...previous, bio: event.target.value }))} placeholder="Conte um pouco sobre seu estilo..." className="resize-y border border-[#dfded7] bg-white px-3 py-3 text-sm font-normal text-[#252b24] outline-none focus:border-[#58725f] focus:ring-2 focus:ring-[#58725f]/10" /></label><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Preferências de estilo<textarea rows={3} maxLength={400} value={profile.stylePreferences} onChange={(event) => setProfile((previous) => ({ ...previous, stylePreferences: event.target.value }))} placeholder="Ex.: minimalista, streetwear, clássico..." className="resize-y border border-[#dfded7] bg-white px-3 py-3 text-sm font-normal text-[#252b24] outline-none focus:border-[#58725f] focus:ring-2 focus:ring-[#58725f]/10" /></label><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Paleta de cores<textarea rows={2} maxLength={240} value={profile.colorPalette} onChange={(event) => setProfile((previous) => ({ ...previous, colorPalette: event.target.value }))} placeholder="Ex.: tons terrosos, neutros, cores vibrantes..." className="resize-y border border-[#dfded7] bg-white px-3 py-3 text-sm font-normal text-[#252b24] outline-none focus:border-[#58725f] focus:ring-2 focus:ring-[#58725f]/10" /></label><div className="border-t border-[#e2e0d8] pt-5"><p className="mb-4 text-[9px] font-bold uppercase tracking-[0.17em] text-[#999a90]">ALTERAR SENHA</p><div className="grid gap-4"><Field label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" placeholder="Obrigatória para alterar e-mail ou senha" /><Field label="Nova senha (opcional)" name="newPassword" type="password" autoComplete="new-password" minLength={6} placeholder="Pelo menos 6 caracteres" /><Field label="Confirmar nova senha" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} placeholder="Repita a nova senha" /></div></div><div><button type="submit" disabled={pendingAction === "profile"} className="flex h-11 items-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-wait disabled:opacity-60">{pendingAction === "profile" ? <><LoaderCircle size={15} className="animate-spin" />Salvando…</> : <><Check size={15} />Salvar perfil</>}</button></div></form>
              </div>
            </> : null}
          </div>
          <footer className="mt-14 flex flex-col justify-between gap-2 border-t border-[#e1dfd7] pt-5 text-[10px] text-[#a0a094] sm:flex-row"><span>stylist © 2026 · Feito para vestir a vida real.</span><span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${currentUser ? "bg-[#739277]" : "bg-[#c79b55]"}`} />{currentUser ? "Seus dados estão sincronizados" : "Entre para sincronizar seus dados"}</span></footer>
        </main>
      </div>

      {notice ? <div role={noticeType === "error" ? "alert" : "status"} className={`app-grain fixed bottom-5 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 border bg-[#fbfaf7] px-4 py-3 text-xs shadow-lg ${noticeType === "error" ? "border-[#e5c4bb] text-[#914937]" : "border-[#d8ded4] text-[#3f5944]"}`}><span aria-hidden="true">{noticeType === "error" ? <CircleHelp size={15} /> : <Check size={15} />}</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso" className="ml-2 text-[#85877d]"><X size={14} /></button></div> : null}
      {itemModal ? <Modal title={editingItem ? "Editar peça" : "Nova peça no closet"} onClose={() => { if (pendingAction === "item") return; setItemModal(false); setItemImage(null); setItemImagePreview(null); }}>
        <form onSubmit={(event) => void submitItem(event)} className="grid gap-4">
          <Field label="Nome da peça" required autoFocus value={itemDraft.name} onChange={(event) => { setItemDraft((draft) => ({ ...draft, name: event.target.value })); setItemError(""); }} placeholder="Ex.: camisa de linho" />
          <label className="grid gap-2 text-xs font-semibold text-[#555d50]">Categoria<select value={itemDraft.category} onChange={(event) => setItemDraft((draft) => ({ ...draft, category: event.target.value }))} className="h-11 border border-[#dfded7] bg-white px-3 text-sm font-normal outline-none focus:border-[#58725f]">{itemCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <Field label="Cor predominante" required value={itemDraft.color} onChange={(event) => { setItemDraft((draft) => ({ ...draft, color: event.target.value })); setItemError(""); }} placeholder="Ex.: verde oliva" />
          <label className="grid gap-2 text-xs font-semibold text-[#555d50]">Estilo / ocasião<select value={itemDraft.style} onChange={(event) => setItemDraft((draft) => ({ ...draft, style: event.target.value }))} className="h-11 border border-[#dfded7] bg-white px-3 text-sm font-normal outline-none focus:border-[#58725f]">{occasions.map((occasion) => <option key={occasion}>{occasion}</option>)}</select></label>
          <label className="grid gap-2 text-xs font-semibold text-[#555d50]">Foto da peça<input type="file" accept="image/jpeg,image/png,image/webp" required={!editingItem} disabled={pendingAction === "item"} onChange={selectItemImage} className="w-full border border-[#dfded7] bg-white px-3 py-2 text-xs font-normal" />{itemImage ? <span className="text-[10px] font-normal text-[#929388]">{itemImage.name} · prévia abaixo</span> : null}</label>
          {itemImagePreview || itemDraft.imageUrl ? <div className="relative aspect-[4/3] max-h-56 overflow-hidden bg-[#19191e]">{itemImagePreview || itemDraft.imageUrl ? <Image src={itemImagePreview || itemDraft.imageUrl} alt="Prévia da peça" fill unoptimized className="object-contain" /> : null}</div> : null}
          {itemUploadProgress ? <div role="status" aria-live="polite" className="grid gap-2"><div className="flex items-center justify-between gap-3 text-[11px] text-[#a3a2ad]"><span>{itemUploadProgress.phase === "processing" ? "Otimizando a foto…" : "Salvando peça…"}</span><span>{itemUploadProgress.phase === "saving" ? "" : `${itemUploadProgress.percent}%`}</span></div><div role="progressbar" aria-label="Progresso ao adicionar a peça" aria-valuemin={0} aria-valuemax={100} aria-valuenow={itemUploadProgress.percent} className="h-1.5 overflow-hidden bg-[#24232b]"><div className="h-full bg-[#314c3c] transition-[width] duration-300" style={{ width: `${itemUploadProgress.percent}%` }} /></div></div> : null}
          {itemError ? <p role="alert" className="border-l-2 border-[#c56750] bg-[#f7eae5] px-3 py-2 text-xs text-[#914937]">{itemError}</p> : null}
          <p className="-mt-1 text-[10px] leading-5 text-[#929388]">JPG, PNG ou WebP · até 10 MB. A foto é otimizada e salva no Firestore.</p>
          <button type="submit" disabled={pendingAction === "item"} className="mt-2 flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-wait disabled:opacity-60">{pendingAction === "item" ? <><LoaderCircle size={15} className="animate-spin" />{itemUploadProgress?.phase === "processing" ? "Otimizando foto…" : "Salvando peça…"}</> : <><Check size={15} />{editingItem ? "Salvar alterações" : "Adicionar ao closet"}</>}</button>
        </form>
      </Modal> : null}

      {lookModal ? <Modal title="Monte um look" onClose={() => setLookModal(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void createOutfit(); }} className="grid gap-4">
          <Field label="Nome do look" required autoFocus maxLength={60} value={lookDraft.name} onChange={(event) => setLookDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Ex.: Sábado sem pressa" />
          <label className="grid gap-2 text-xs font-semibold text-[#555d50]">Ocasião<select value={lookDraft.occasion} onChange={(event) => setLookDraft((draft) => ({ ...draft, occasion: event.target.value }))} className="h-11 border border-[#dfded7] bg-white px-3 text-sm font-normal outline-none focus:border-[#58725f]">{occasions.map((occasion) => <option key={occasion}>{occasion}</option>)}</select></label>
          <div className="flex items-center justify-between gap-3 border-y border-[#e2e0d8] py-3"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#85877d]">Selecione as peças · {selected.length}</span><button type="button" onClick={() => { setLookModal(false); navigateToSection("closet"); }} className="text-[11px] font-semibold text-[#4f6b54]">Abrir closet</button></div>
          {items.length ? <div className="grid max-h-[34vh] grid-cols-2 gap-x-4 gap-y-5 overflow-y-auto pr-1 sm:grid-cols-3">{items.map((item) => <ImageTile key={item.id} item={item} selectable />)}</div> : <p className="border border-dashed border-[#d8d7ce] py-8 text-center text-xs text-[#85877d]">Adicione peças ao closet antes de montar um look.</p>}
          <button type="submit" disabled={pendingAction === "look" || !selected.length || !lookDraft.name.trim()} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-not-allowed disabled:opacity-50">{pendingAction === "look" ? <><LoaderCircle size={15} className="animate-spin" />Salvando…</> : <><Check size={15} />Salvar look</>}</button>
        </form>
      </Modal> : null}

      {authModal ? <Modal title={registering ? "Seu estilo começa aqui." : "Que bom ter você de volta."} onClose={() => { setAuthModal(false); setAuthError(""); }}>
        <p className="-mt-3 mb-6 text-sm text-[#7e8176]">{registering ? "Crie sua conta para guardar suas peças e looks." : "Entre para acessar seu closet de qualquer lugar."}</p>
        <form onSubmit={(event) => void submitAuth(event)} className="grid gap-4">{registering ? <Field label="Seu nome" name="name" autoComplete="name" required placeholder="Nome e sobrenome" /> : null}<Field label="E-mail" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" /><Field label="Senha" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={6} required placeholder="Mínimo de 6 caracteres" />{authError ? <p role="alert" className="border-l-2 border-[#c56750] bg-[#f7eae5] px-3 py-2 text-xs leading-5 text-[#914937]">{authError}</p> : null}<button type="submit" disabled={busy} className="mt-1 flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:opacity-60">{busy ? "Aguarde…" : registering ? "Criar minha conta" : "Entrar"}<ArrowRight size={15} /></button></form>
        <p className="mt-5 text-center text-xs text-[#85877d]">{registering ? "Já tem conta?" : "Primeira vez por aqui?"} <button type="button" onClick={() => { setRegistering((previous) => !previous); setAuthError(""); }} className="font-semibold text-[#4f6b54] underline decoration-[#a6b5a4] underline-offset-2">{registering ? "Entrar" : "Criar conta"}</button></p>
        {!firebaseEnabled ? <p className="mt-4 border-t border-[#e6e4dc] pt-4 text-center text-[10px] leading-5 text-[#96978d]">Configure as variáveis NEXT_PUBLIC_FIREBASE no ambiente e habilite E-mail/senha no Firebase Authentication para entrar ou criar sua conta.</p> : null}
      </Modal> : null}
      {sharing ? <Modal title="Compartilhe seu look." onClose={() => setSharing(false)}><form onSubmit={(event) => void publishPost(event)} className="grid gap-4"><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Look salvo<select name="outfitId" value={sharingOutfitId} onChange={(event) => setSharingOutfitId(event.target.value)} className="h-11 border border-[#dfded7] bg-white px-3 text-sm font-normal outline-none focus:border-[#58725f]">{outfits.map((outfit) => <option key={outfit.id} value={outfit.id}>{outfit.name} · {outfit.occasion}</option>)}</select></label>{outfits.find((outfit) => outfit.id === sharingOutfitId) ? <div className="grid grid-cols-4 gap-2">{outfits.find((outfit) => outfit.id === sharingOutfitId)?.itemIds.slice(0, 4).map((id) => { const item = items.find((entry) => entry.id === id); return <span key={id} className="relative aspect-[4/5] overflow-hidden bg-[#19191e]">{item?.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized className="object-cover" /> : <Shirt className="absolute inset-0 m-auto text-[#8b8c82]" size={17} />}</span>; })}</div> : null}<label className="grid gap-2 text-xs font-semibold text-[#555d50]">Legenda (opcional)<textarea name="caption" maxLength={400} rows={4} placeholder="Conte algo sobre esse look..." className="resize-y border border-[#dfded7] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#58725f]" /></label><p className="text-[10px] leading-5 text-[#929388]">Seu look e as fotos das peças serão visíveis para membros autenticados da comunidade.</p><button type="submit" disabled={pendingAction === "post" || !sharingOutfitId} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-wait disabled:opacity-60">{pendingAction === "post" ? <><LoaderCircle size={15} className="animate-spin" />Publicando…</> : <><Plus size={15} />Publicar no feed</>}</button></form></Modal> : null}
    </div>
  );
}
