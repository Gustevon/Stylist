"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  UserRound,
  X,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/lib/firebase/client";
import {
  addComment,
  removeItem,
  saveItem,
  saveOutfit,
  savePost,
  saveProfile,
  toggleLike,
  watchFeed,
  watchItems,
  watchOutfits,
  watchProfile,
} from "@/lib/stylist/store";
import { demoItems, demoOutfits, demoPosts, demoProfile } from "@/lib/stylist/demo-data";
import type { CommunityPost, Outfit, Section, UserProfile, WardrobeItem } from "@/lib/stylist/types";

const navItems: { id: Section; label: string; icon: typeof House }[] = [
  { id: "inicio", label: "Visão geral", icon: House },
  { id: "closet", label: "Meu closet", icon: Shirt },
  { id: "looks", label: "Looks", icon: Sparkles },
  { id: "feed", label: "Comunidade", icon: Heart },
  { id: "perfil", label: "Meu perfil", icon: UserRound },
];

const categories = ["Todas", "Roupas", "Calçados", "Acessórios"];
const emptyDraft = { name: "", category: "Roupas", type: "Blusas", color: "", imageUrl: "" };
const blankProfile: UserProfile = { name: "", email: "", height: "", weight: "", stylePreferences: "" };
const heroImage = "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1400&q=90";

function uid(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

function maskMeasurement(value: string, maxIntegerDigits: number, maxDecimalDigits: number) {
  const input = value.replace(/[^\d.,]/g, "");
  const separator = input.search(/[.,]/);
  if (separator >= 0) {
    const integer = input.slice(0, separator).replace(/\D/g, "").slice(0, maxIntegerDigits);
    const decimal = input.slice(separator + 1).replace(/\D/g, "").slice(0, maxDecimalDigits);
    return decimal ? `${integer},${decimal}` : `${integer},`;
  }

  const digits = input.replace(/\D/g, "").slice(0, maxIntegerDigits + maxDecimalDigits);
  if (maxIntegerDigits === 1 && digits.length > 1) return `${digits[0]},${digits.slice(1)}`;
  return digits;
}

function parseMeasurement(value: string) {
  return Number(value.replace(",", "."));
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
      <section role="dialog" aria-modal="true" aria-label={title} className="enter-view max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm bg-[#fbfaf7] p-6 shadow-2xl sm:p-8">
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
  const pathname = usePathname();
  const router = useRouter();
  const section = (pathname === "/" ? "inicio" : pathname.slice(1)) as Section;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [items, setItems] = useState(demoItems);
  const [outfits, setOutfits] = useState(demoOutfits);
  const [posts, setPosts] = useState(demoPosts);
  const [profile, setProfile] = useState<UserProfile>(demoProfile);
  const [selected, setSelected] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [authModal, setAuthModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [itemDraft, setItemDraft] = useState(emptyDraft);
  const [itemError, setItemError] = useState("");
  const [profileErrors, setProfileErrors] = useState<{ height?: string; weight?: string }>({});
  const [authError, setAuthError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      setItems(demoItems);
      setOutfits(demoOutfits);
      setPosts(demoPosts);
      setProfile(user ? { ...blankProfile, email: user.email ?? "" } : demoProfile);
    });
  }, []);

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
    return () => { stopItems(); stopOutfits(); stopProfile(); stopPosts(); };
  }, [currentUser]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const displayName = currentUser?.displayName || profile.name || "Marina Costa";
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === "Todas" || item.category === categoryFilter;
    const matchesSearch = `${item.name} ${item.type} ${item.color}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
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

  if (!navItems.some(({ id }) => id === section)) return null;

  function openItemEditor(item?: WardrobeItem) {
    setEditingItem(item ?? null);
    setItemDraft(item ? { name: item.name, category: item.category, type: item.type, color: item.color, imageUrl: item.imageUrl } : emptyDraft);
    setItemModal(true);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemDraft.name.trim() || !itemDraft.type.trim() || !itemDraft.color.trim()) {
      setItemError("Preencha o nome, tipo e cor da peça.");
      return;
    }
    setItemError("");
    const item: WardrobeItem = {
      id: editingItem?.id ?? uid("item"),
      ...itemDraft,
      createdAt: editingItem?.createdAt ?? Date.now(),
    };
    setPendingAction("item");
    try {
      if (currentUser) await saveItem(currentUser.uid, item);
      else setItems((previous) => editingItem ? previous.map((entry) => entry.id === item.id ? item : entry) : [item, ...previous]);
      setItemModal(false);
      showNotice(editingItem ? "Peça atualizada." : "Peça adicionada ao closet.");
    } catch {
      showNotice("Não foi possível salvar a peça. Tente novamente.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteWardrobeItem(item: WardrobeItem) {
    if (!window.confirm(`Remover “${item.name}” do closet?`)) return;
    if (currentUser && !item.id.startsWith("item-")) {
      try { await removeItem(currentUser.uid, item.id); }
      catch { showNotice("Não foi possível remover a peça.", "error"); return; }
    } else {
      setItems((previous) => previous.filter((entry) => entry.id !== item.id));
    }
    setOutfits((previous) => previous.map((outfit) => ({ ...outfit, itemIds: outfit.itemIds.filter((id) => id !== item.id) })));
    setSelected((previous) => previous.filter((id) => id !== item.id));
    showNotice("Peça removida do closet.");
  }

  async function createOutfit() {
    if (selected.length < 2) return;
    const outfit: Outfit = { id: uid("look"), name: `Look ${String(outfits.length + 1).padStart(2, "0")}`, itemIds: selected, favorite: false, createdAt: Date.now() };
    if (currentUser) {
      try { await saveOutfit(currentUser.uid, outfit); }
      catch { showNotice("Não foi possível salvar o look.", "error"); return; }
    } else setOutfits((previous) => [outfit, ...previous]);
    setSelected([]);
    navigateToSection("looks");
    showNotice("Look salvo. Uma boa combinação começa assim.");
  }

  async function toggleFavorite(outfit: Outfit) {
    const updated = { ...outfit, favorite: !outfit.favorite };
    if (currentUser) {
      try { await saveOutfit(currentUser.uid, updated); }
      catch { showNotice("Não foi possível atualizar o favorito.", "error"); return; }
    } else setOutfits((previous) => previous.map((entry) => entry.id === outfit.id ? updated : entry));
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { height?: string; weight?: string } = {};
    const height = parseMeasurement(profile.height);
    const weight = parseMeasurement(profile.weight);
    if (profile.height.trim() && (!Number.isFinite(height) || height < 0.5 || height > 2.5)) {
      nextErrors.height = "Informe uma altura entre 0,50 m e 2,50 m.";
    }
    if (profile.weight.trim() && (!Number.isFinite(weight) || weight < 1 || weight > 500)) {
      nextErrors.weight = "Informe um peso entre 1 kg e 500 kg.";
    }
    setProfileErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setPendingAction("profile");
    try {
      if (currentUser) await saveProfile(currentUser.uid, { ...profile, email: currentUser.email ?? profile.email });
      showNotice("Perfil atualizado.");
    } catch {
      showNotice("Não foi possível salvar seu perfil.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) { setAuthError("Configure as variáveis NEXT_PUBLIC_FIREBASE no ambiente para ativar sua conta."); return; }
    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    try {
      if (registering) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(credential.user, { displayName: name });
        const newProfile = { ...blankProfile, name, email };
        await saveProfile(credential.user.uid, newProfile);
        setProfile(newProfile);
      } else await signInWithEmailAndPassword(auth, email, password);
      setAuthModal(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível entrar. Confira seus dados.");
    } finally { setBusy(false); }
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const imageUrl = String(form.get("imageUrl") ?? "").trim();
    const caption = String(form.get("caption") ?? "").trim();
    const post: Omit<CommunityPost, "id"> = {
      ownerId: currentUser?.uid ?? "demo-user", author: displayName,
      handle: currentUser?.email?.split("@")[0] ?? "marinacosta", avatar: initials,
      imageUrl, caption, likes: [], commentsCount: 0, createdAt: Date.now(),
    };
    setPendingAction("post");
    try {
      if (currentUser) await savePost(post);
      else setPosts((previous) => [{ ...post, id: uid("post") }, ...previous]);
      setSharing(false);
      navigateToSection("feed");
      showNotice("Seu look já está no feed.");
    } catch {
      showNotice("Não foi possível publicar. Verifique as permissões do feed.", "error");
    } finally {
      setPendingAction(null);
    }
  }

  async function likePost(post: CommunityPost) {
    const liked = post.likes.includes(currentUser?.uid ?? "demo-user");
    if (currentUser) {
      try { await toggleLike(post.id, currentUser.uid, liked); }
      catch { showNotice("Entre na comunidade para curtir publicações.", "error"); }
    } else setPosts((previous) => previous.map((entry) => entry.id !== post.id ? entry : { ...entry, likes: liked ? entry.likes.filter((id) => id !== "demo-user") : [...entry.likes, "demo-user"] }));
  }

  async function commentOnPost(event: FormEvent<HTMLFormElement>, post: CommunityPost) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("comment") ?? "").trim();
    if (!text) return;
    if (currentUser) {
      try { await addComment(post.id, currentUser.uid, displayName, text); }
      catch { showNotice("Não foi possível enviar o comentário.", "error"); return; }
    } else setPosts((previous) => previous.map((entry) => entry.id === post.id ? { ...entry, commentsCount: entry.commentsCount + 1 } : entry));
    event.currentTarget.reset();
    showNotice("Comentário enviado.");
  }

  function ImageTile({ item, selectable = false }: { item: WardrobeItem; selectable?: boolean }) {
    const isSelected = selected.includes(item.id);
    return (
      <article className={`group min-w-0 ${selectable && isSelected ? "ring-2 ring-[#58725f] ring-offset-2 ring-offset-[#f5f3ed]" : ""}`}>
        <button type="button" onClick={() => selectable ? setSelected((previous) => isSelected ? previous.filter((id) => id !== item.id) : [...previous, item.id]) : openItemEditor(item)} className="relative block aspect-[4/5] w-full overflow-hidden bg-[#e7e4db] text-left" aria-label={selectable ? `${isSelected ? "Desmarcar" : "Selecionar"} ${item.name}` : `Editar ${item.name}`}>
          <Image src={item.imageUrl || heroImage} alt={item.name} fill unoptimized sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" />
          {selectable ? <span className={`absolute right-3 top-3 grid size-6 place-items-center border ${isSelected ? "border-[#314c3c] bg-[#314c3c] text-white" : "border-white/80 bg-white/75 text-transparent"}`}><Check size={14} /></span> : null}
          {!selectable ? <span className="absolute bottom-3 left-3 bg-[#f7f5ef]/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#354238]">{item.color}</span> : null}
        </button>
        <div className="flex items-start justify-between gap-2 pt-3">
          <button type="button" onClick={() => selectable ? setSelected((previous) => isSelected ? previous.filter((id) => id !== item.id) : [...previous, item.id]) : openItemEditor(item)} className="min-w-0 text-left">
            <span className="block truncate text-sm font-semibold text-[#343b32]">{item.name}</span>
            <span className="mt-1 block text-xs text-[#85887e]">{item.type} · {item.color}</span>
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
          {pieces.slice(0, 3).map((item) => <div key={item.id} className="relative aspect-[4/5] overflow-hidden bg-[#e7e4db]"><Image src={item.imageUrl || heroImage} alt={item.name} fill unoptimized sizes="(max-width: 640px) 33vw, 20vw" className="object-cover" /></div>)}
          {pieces.length === 0 ? <div className="col-span-3 grid aspect-[4/2] place-items-center bg-[#e9e7df] text-sm text-[#777c70]">As peças desse look não estão mais no closet.</div> : null}
        </div>
        <div className="flex items-center justify-between gap-3 pt-4">
          <div><h3 className="font-display text-xl text-[#313a30]">{outfit.name}</h3><p className="mt-1 text-xs text-[#888a80]">{pieces.length} peças · salvo recentemente</p></div>
          <button type="button" onClick={() => void toggleFavorite(outfit)} aria-label={outfit.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} title={outfit.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} className={`grid size-10 place-items-center rounded-full border transition ${outfit.favorite ? "border-[#d7b2a6] bg-[#f7eae5] text-[#bd624b]" : "border-[#dfded7] text-[#83867c] hover:border-[#d7b2a6] hover:text-[#bd624b]"}`}><Heart size={17} fill={outfit.favorite ? "currentColor" : "none"} /></button>
        </div>
      </article>
    );
  }

  const sectionTitle: Record<Section, { eyebrow: string; title: string; detail: string }> = {
    inicio: { eyebrow: "UM NOVO DIA, DO SEU JEITO", title: "Vista o que faz sentido.", detail: "Seu estilo já está aqui. Vamos encontrar novas combinações?" },
    closet: { eyebrow: "SEU ACERVO PESSOAL", title: "Meu closet", detail: `${items.length} peças para vestir os seus dias.` },
    looks: { eyebrow: "COMBINAÇÕES COM INTENÇÃO", title: "Looks salvos", detail: "Ideias prontas para os dias em que o armário parece cheio demais." },
    feed: { eyebrow: "ESTILO É TROCA", title: "Inspiração que circula.", detail: "Looks reais, ideias novas e gente que veste do seu jeito." },
    perfil: { eyebrow: "DO SEU JEITO", title: "Seu perfil", detail: "Um pouco sobre suas medidas, suas referências e você." },
  };

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
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e6d5c8] text-[11px] font-semibold text-[#6a5142]">{initials}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#3a4037]">{displayName}</span><span className="mt-0.5 block truncate text-[10px] text-[#8d8e84]">{currentUser?.email ?? "Seu espaço pessoal"}</span></span>
            {currentUser ? <button type="button" title="Sair da conta" aria-label="Sair da conta" onClick={() => auth && void signOut(auth)} className="grid size-8 place-items-center text-[#85877d] hover:text-[#b74e3d]"><LogOut size={15} /></button> : null}
          </div>
          {!currentUser ? <button type="button" onClick={() => { setRegistering(false); setAuthModal(true); }} className="flex h-10 w-full items-center justify-center gap-2 border border-[#d9ded5] text-xs font-semibold text-[#46604c] transition hover:bg-[#eef1eb]"><LogIn size={15} />Entrar ou criar conta</button> : <span className="flex items-center gap-2 px-1 text-[10px] text-[#62806a]"><span className="size-1.5 rounded-full bg-[#749479]" />Conta sincronizada</span>}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[78px] items-center justify-between border-b border-[#e1dfd7] bg-[#f5f3ed]/95 px-4 backdrop-blur sm:px-8 lg:h-[66px] lg:px-12">
          <button type="button" onClick={() => navigateToSection("inicio")} className="flex items-center lg:hidden"><span className="relative block h-[74px] w-[130px] bg-black"><Image src="/logo-stylist-complete.jpeg" alt="Stylist Your Wardrobe" fill priority sizes="130px" className="object-contain" /></span></button>
          <div className="hidden items-center gap-2 text-xs text-[#96968c] lg:flex"><span>Seu espaço</span><span>/</span><span className="font-medium text-[#4b5349]">{navItems.find((item) => item.id === section)?.label}</span></div>
          <div className="ml-auto flex items-center gap-3">
            {!firebaseEnabled ? <span className="hidden items-center gap-1.5 border border-[#e4d9c3] bg-[#f5eddf] px-2.5 py-1.5 text-[10px] font-medium text-[#897047] sm:flex"><span className="size-1.5 rounded-full bg-[#c79b55]" />Modo demonstração</span> : null}
            <button type="button" onClick={() => { setRegistering(false); setAuthModal(true); }} className="flex items-center gap-2 text-left" title={currentUser ? currentUser.email ?? "Perfil" : "Entrar na conta"}><span className="grid size-8 place-items-center rounded-full bg-[#e6d5c8] text-[10px] font-semibold text-[#6a5142]">{initials}</span><ChevronDown className="hidden text-[#85877d] sm:block" size={13} /></button>
          </div>
        </header>

        <nav className="sticky top-[78px] z-20 flex overflow-x-auto border-b border-[#e5e3dc] bg-[#f8f7f2] px-3 py-2 lg:hidden" aria-label="Navegação móvel">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigateToSection(id)} aria-current={section === id ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 px-3 text-xs ${section === id ? "border-b-2 border-[#48624d] font-semibold text-[#314c3c]" : "text-[#777c70]"}`}><Icon size={15} />{label}</button>)}
          {!currentUser ? <button type="button" onClick={() => { setRegistering(false); setAuthModal(true); }} className="ml-auto flex shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-[#48624d]"><LogIn size={15} />Entrar</button> : <button type="button" onClick={() => auth && void signOut(auth)} aria-label="Sair da conta" className="ml-auto grid size-10 shrink-0 place-items-center text-[#777c70]"><LogOut size={15} /></button>}
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
                  { label: "INTERAÇÕES", value: posts.reduce((total, post) => total + post.likes.length + post.commentsCount, 0), note: "na comunidade", icon: ChartNoAxesColumnIncreasing },
                ].map(({ label, value, note, icon: Icon }, index) => <article key={label} className="border border-[#24232b] bg-[#101114] px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a8996]">{label}</span><Icon size={15} className={index % 2 === 0 ? "text-[#c6ff3d]" : "text-[#8a2be2]"} /></div><div className="mt-3 flex items-baseline justify-between gap-2"><span className="font-display text-[27px] leading-none text-white sm:text-[31px]">{value}</span><span className="text-right text-[9px] text-[#767580]">{note}</span></div></article>)}
              </section>
              <section className="hero-panel relative grid min-h-[290px] overflow-hidden sm:min-h-[340px] lg:grid-cols-[1fr_0.85fr]">
                <div className="relative z-10 flex flex-col items-start justify-center px-6 py-9 text-[#f6f1e8] sm:px-10 lg:px-12">
                  <span className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4d5c7]"><Sparkles size={13} />Um bom dia começa no espelho</span>
                  <h2 className="font-display max-w-md text-[36px] leading-[1.04] sm:text-[45px]">Menos peças.<br />Mais possibilidades.</h2>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-[#d0d5ca]">Você já tem {items.length} peças para criar algo novo hoje.</p>
                  <button type="button" onClick={() => { setSelected([]); navigateToSection("looks"); }} className="mt-7 flex h-11 items-center gap-3 border border-white/35 px-4 text-xs font-semibold text-white transition hover:bg-white/10">Montar um look <ArrowRight size={15} /></button>
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
                  {outfits.slice(0, 2).map((outfit) => <div key={outfit.id} className="mb-3 flex items-center gap-3 border-b border-[#e7e5de] pb-3"><div className="flex -space-x-2">{outfit.itemIds.slice(0, 3).map((id) => { const item = items.find((entry) => entry.id === id); return <span key={id} className="relative size-10 overflow-hidden rounded-full border-2 border-[#f5f3ed] bg-[#e7e4db]"><Image src={item?.imageUrl || heroImage} alt="" fill unoptimized sizes="40px" className="object-cover" /></span>; })}</div><div className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#42483f]">{outfit.name}</span><span className="mt-1 block text-[10px] text-[#94958b]">{outfit.itemIds.length} peças</span></div>{outfit.favorite ? <Heart size={15} className="text-[#bf705c]" fill="currentColor" /> : null}</div>)}
                  <p className="mt-5 flex items-center gap-2 text-[11px] text-[#888b80]"><Bookmark size={13} />{favoriteCount} looks favoritos</p>
                </section>
              </div>
              <section className="mt-10 border-t border-[#e3e1d9] pt-7"><div className="mb-4 flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999a90]">DA COMUNIDADE</p><h2 className="mt-1 font-display text-[25px] text-[#333c32]">Uma ideia para levar</h2></div><button type="button" onClick={() => navigateToSection("feed")} className="flex items-center gap-1 text-xs font-semibold text-[#58705c]">Abrir feed <ArrowRight size={13} /></button></div><div className="flex items-center gap-4 border-y border-[#e4e2db] py-4"><span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[#e7e4db]"><Image src={posts[0]?.imageUrl ?? heroImage} alt="" fill unoptimized sizes="48px" className="object-cover" /></span><p className="min-w-0 flex-1 text-sm leading-6 text-[#656c61]">“{posts[0]?.caption ?? "Compartilhe seu próximo look com a comunidade."}”</p><span className="hidden text-xs font-semibold text-[#42483f] sm:block">{posts[0]?.author}</span></div></section>
            </> : null}

            {section === "closet" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.closet.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Meu closet<span className="ml-2 align-top font-sans text-[13px] font-medium text-[#9b9b90]">{items.length}</span></h1><p className="mt-3 text-sm text-[#7e8176]">{sectionTitle.closet.detail}</p></div><button type="button" onClick={() => openItemEditor()} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d]"><Plus size={16} />Adicionar peça</button></div>
              <div className="mb-6 flex flex-col gap-4 border-y border-[#e2e0d8] py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-1 overflow-x-auto">{categories.map((category) => <button key={category} type="button" onClick={() => setCategoryFilter(category)} className={`shrink-0 px-3 py-2 text-xs transition ${categoryFilter === category ? "bg-[#314c3c] font-semibold text-white" : "text-[#777c70] hover:bg-[#e9e8e1]"}`}>{category}</button>)}</div><label className="flex h-10 items-center gap-2 border-b border-[#d9d8d0] px-2 text-[#8a8c82] sm:w-56"><Search size={15} /><input aria-label="Buscar peças" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no closet" className="min-w-0 flex-1 bg-transparent text-xs text-[#374037] outline-none placeholder:text-[#a1a196]" /></label></div>
              {filteredItems.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4">{filteredItems.map((item) => <ImageTile key={item.id} item={item} />)}</div> : <div className="grid min-h-56 place-items-center border border-dashed border-[#d8d7ce] text-center"><div><Shirt className="mx-auto text-[#92968b]" size={25} /><p className="mt-3 font-display text-xl text-[#384238]">Nada por aqui ainda.</p><p className="mt-1 text-xs text-[#888a80]">Experimente outra busca ou adicione uma peça.</p></div></div>}
            </> : null}

            {section === "looks" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.looks.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Looks salvos<span className="ml-2 align-top font-sans text-[13px] font-medium text-[#9b9b90]">{outfits.length}</span></h1><p className="mt-3 text-sm text-[#7e8176]">Escolha peças abaixo para montar uma combinação.</p></div><button type="button" onClick={() => navigateToSection("closet")} className="flex h-11 items-center justify-center gap-2 border border-[#d7d8ce] px-4 text-xs font-semibold text-[#425a47] hover:bg-[#e9ece5]"><Shirt size={15} />Explorar closet</button></div>
              <div className="mb-10 border-y border-[#e2e0d8] py-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#85877d]">Selecione duas ou mais peças</p><button type="button" disabled={selected.length < 2} onClick={() => void createOutfit()} className="flex h-9 items-center gap-2 bg-[#314c3c] px-3 text-xs font-semibold text-white transition hover:bg-[#253b2d] disabled:cursor-not-allowed disabled:bg-[#b5b9af]"><Plus size={14} />Criar look{selected.length ? ` · ${selected.length}` : ""}</button></div><div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">{items.map((item) => <ImageTile key={item.id} item={item} selectable />)}</div></div>
              <div className="mb-4 flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999a90]">SUAS COMBINAÇÕES</p><h2 className="mt-1 font-display text-[26px] text-[#333c32]">Prontos para repetir</h2></div><span className="text-xs text-[#8b8d83]">{favoriteCount} favoritos</span></div>
              {outfits.length ? <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">{outfits.map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} />)}</div> : <p className="border-y border-[#e3e1d9] py-8 text-sm text-[#85877d]">Ainda não há looks. Selecione algumas peças para começar.</p>}
            </> : null}

            {section === "feed" ? <>
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.feed.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Inspiração que circula.</h1><p className="mt-3 text-sm text-[#7e8176]">{sectionTitle.feed.detail}</p></div><button type="button" onClick={() => setSharing(true)} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d]"><Plus size={16} />Compartilhar look</button></div>
              {posts.length ? <div className="grid gap-7 lg:grid-cols-2">{posts.map((post) => {
                const liked = post.likes.includes(currentUser?.uid ?? "demo-user");
                return <article key={post.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] border-y border-[#e1dfd7] py-4 sm:gap-4">
                  <div className="relative min-h-60 overflow-hidden bg-[#e8e4db] sm:min-h-80"><Image src={post.imageUrl || heroImage} alt={`Look compartilhado por ${post.author}`} fill unoptimized sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" /><span className="absolute bottom-3 left-3 border border-white/50 bg-[#f8f7f2]/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#485347]">look do dia</span></div>
                  <div className="flex min-w-0 flex-col justify-between py-1 sm:py-2"><div><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8ddd2] text-[9px] font-bold text-[#685344]">{post.avatar}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-[#40483e]">{post.author}</span><span className="block truncate text-[10px] text-[#999a90]">@{post.handle}</span></span></div><p className="mt-4 text-xs leading-[1.8] text-[#666d62]">{post.caption}</p></div><div><div className="flex items-center gap-4 border-t border-[#e7e5de] pt-3"><button type="button" onClick={() => void likePost(post)} aria-label={liked ? "Descurtir publicação" : "Curtir publicação"} className={`flex items-center gap-1.5 text-xs ${liked ? "text-[#c36350]" : "text-[#82867c] hover:text-[#c36350]"}`}><Heart size={16} fill={liked ? "currentColor" : "none"} />{post.likes.length + (liked && !post.likes.includes(currentUser?.uid ?? "demo-user") ? 1 : 0)}</button><button type="button" onClick={() => setCommentsOpen(commentsOpen === post.id ? null : post.id)} className="flex items-center gap-1.5 text-xs text-[#82867c] hover:text-[#4e6751]"><MessageCircle size={15} />{post.commentsCount} <span className="hidden sm:inline">comentários</span></button></div>{commentsOpen === post.id ? <form onSubmit={(event) => void commentOnPost(event, post)} className="mt-3 flex gap-2"><input name="comment" maxLength={240} required placeholder="Escreva um comentário" className="min-w-0 flex-1 border-b border-[#d7d8ce] bg-transparent py-2 text-[11px] outline-none placeholder:text-[#a2a397]" /><button type="submit" aria-label="Enviar comentário" className="text-[11px] font-semibold text-[#4f6b54]">Enviar</button></form> : null}</div></div>
                </article>;
              })}</div> : <div className="grid min-h-56 place-items-center border border-dashed border-[#d8d7ce] text-center"><div><Heart className="mx-auto text-[#92968b]" size={25} /><p className="mt-3 font-display text-xl text-[#384238]">O feed está tranquilo por enquanto.</p><p className="mt-1 text-xs text-[#888a80]">Compartilhe um look para iniciar a conversa.</p></div></div>}
            </> : null}

            {section === "perfil" ? <>
              <div className="mb-8"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#929287]">{sectionTitle.perfil.eyebrow}</p><h1 className="font-display text-[42px] leading-none text-[#29362c]">Seu perfil</h1><p className="mt-3 text-sm text-[#7e8176]">{sectionTitle.perfil.detail}</p></div>
              <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
                <section className="border-y border-[#e2e0d8] py-6"><div className="flex items-center gap-4"><span className="grid size-16 place-items-center rounded-full bg-[#e6d5c8] font-display text-[22px] text-[#6a5142]">{initials}</span><div><h2 className="font-display text-[25px] text-[#333c32]">{displayName}</h2><p className="mt-1 text-xs text-[#8d8f84]">{currentUser?.email ?? profile.email}</p></div></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="bg-[#eae9e2] p-4"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#929388]">Altura</span><p className="mt-2 font-display text-2xl text-[#384238]">{profile.height || "—"}<span className="ml-1 text-xs">m</span></p></div><div className="bg-[#eae9e2] p-4"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#929388]">Peso</span><p className="mt-2 font-display text-2xl text-[#384238]">{profile.weight || "—"}<span className="ml-1 text-xs">kg</span></p></div></div><div className="mt-5 flex justify-between border-b border-[#e3e1d9] py-3 text-xs"><span className="text-[#85877d]">Peças no closet</span><span className="font-semibold text-[#485146]">{items.length}</span></div><div className="flex justify-between border-b border-[#e3e1d9] py-3 text-xs"><span className="text-[#85877d]">Looks favoritos</span><span className="font-semibold text-[#485146]">{favoriteCount}</span></div><p className="mt-5 flex items-start gap-2 text-[10px] leading-5 text-[#999a90]"><CircleHelp size={14} className="mt-0.5 shrink-0" />Suas medidas ficam visíveis apenas para você.</p></section>
                <form onSubmit={(event) => void submitProfile(event)} className="grid content-start gap-5 border-y border-[#e2e0d8] py-6"><div className="mb-1"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#999a90]">INFORMAÇÕES PESSOAIS</p><h2 className="mt-1 font-display text-[26px] text-[#333c32]">Medidas e preferências</h2></div><Field label="Como podemos te chamar?" value={profile.name} onChange={(event) => setProfile((previous) => ({ ...previous, name: event.target.value }))} placeholder="Seu nome" /><div className="grid grid-cols-2 gap-4"><div className="grid content-start gap-2"><Field label="Altura (m)" inputMode="decimal" maxLength={4} aria-invalid={Boolean(profileErrors.height)} aria-describedby={profileErrors.height ? "height-error" : undefined} value={profile.height} onChange={(event) => { setProfile((previous) => ({ ...previous, height: maskMeasurement(event.target.value, 1, 2) })); setProfileErrors((previous) => ({ ...previous, height: undefined })); }} placeholder="1,68" />{profileErrors.height ? <p id="height-error" role="alert" className="text-[10px] leading-4 text-[#b74e3d]">{profileErrors.height}</p> : null}</div><div className="grid content-start gap-2"><Field label="Peso (kg)" inputMode="decimal" maxLength={5} aria-invalid={Boolean(profileErrors.weight)} aria-describedby={profileErrors.weight ? "weight-error" : undefined} value={profile.weight} onChange={(event) => { setProfile((previous) => ({ ...previous, weight: maskMeasurement(event.target.value, 3, 1) })); setProfileErrors((previous) => ({ ...previous, weight: undefined })); }} placeholder="58" />{profileErrors.weight ? <p id="weight-error" role="alert" className="text-[10px] leading-4 text-[#b74e3d]">{profileErrors.weight}</p> : null}</div></div><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Preferências de estilo<textarea rows={4} value={profile.stylePreferences} onChange={(event) => setProfile((previous) => ({ ...previous, stylePreferences: event.target.value }))} placeholder="Cores, referências, tecidos..." className="resize-y border border-[#dfded7] bg-white px-3 py-3 text-sm font-normal text-[#252b24] outline-none focus:border-[#58725f] focus:ring-2 focus:ring-[#58725f]/10" /></label><div><button type="submit" disabled={pendingAction === "profile"} className="flex h-11 items-center gap-2 bg-[#314c3c] px-5 text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-wait disabled:opacity-60">{pendingAction === "profile" ? <><LoaderCircle size={15} className="animate-spin" />Salvando…</> : <><Check size={15} />Salvar perfil</>}</button></div></form>
              </div>
            </> : null}
          </div>
          <footer className="mt-14 flex flex-col justify-between gap-2 border-t border-[#e1dfd7] pt-5 text-[10px] text-[#a0a094] sm:flex-row"><span>stylist © 2026 · Feito para vestir a vida real.</span><span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${currentUser ? "bg-[#739277]" : "bg-[#c79b55]"}`} />{currentUser ? "Seus dados estão sincronizados" : "Demonstração · dados temporários"}</span></footer>
        </main>
      </div>

      {notice ? <div role={noticeType === "error" ? "alert" : "status"} className={`fixed bottom-5 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 border bg-[#fbfaf7] px-4 py-3 text-xs shadow-lg ${noticeType === "error" ? "border-[#e5c4bb] text-[#914937]" : "border-[#d8ded4] text-[#3f5944]"}`}><span aria-hidden="true">{noticeType === "error" ? <CircleHelp size={15} /> : <Check size={15} />}</span>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso" className="ml-2 text-[#85877d]"><X size={14} /></button></div> : null}
      {!authReady ? <div className="fixed bottom-4 right-4 size-2 animate-pulse rounded-full bg-[#58725f]" aria-label="Conectando" /> : null}

      {itemModal ? <Modal title={editingItem ? "Editar peça" : "Nova peça no closet"} onClose={() => setItemModal(false)}>
        <form onSubmit={(event) => void submitItem(event)} className="grid gap-4">
          <Field label="Nome da peça" required autoFocus value={itemDraft.name} onChange={(event) => { setItemDraft((draft) => ({ ...draft, name: event.target.value })); setItemError(""); }} placeholder="Ex.: camisa de linho" />
          <div className="grid grid-cols-2 gap-4"><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Categoria<select value={itemDraft.category} onChange={(event) => setItemDraft((draft) => ({ ...draft, category: event.target.value }))} className="h-11 border border-[#dfded7] bg-white px-3 text-sm font-normal outline-none focus:border-[#58725f]"><option>Roupas</option><option>Calçados</option><option>Acessórios</option></select></label><Field label="Tipo" required value={itemDraft.type} onChange={(event) => { setItemDraft((draft) => ({ ...draft, type: event.target.value })); setItemError(""); }} placeholder="Ex.: blusas" /></div>
          <Field label="Cor principal" required value={itemDraft.color} onChange={(event) => { setItemDraft((draft) => ({ ...draft, color: event.target.value })); setItemError(""); }} placeholder="Ex.: verde oliva" />
          <Field label="URL da imagem" type="url" value={itemDraft.imageUrl} onChange={(event) => setItemDraft((draft) => ({ ...draft, imageUrl: event.target.value }))} placeholder="https://..." />
          {itemError ? <p role="alert" className="border-l-2 border-[#c56750] bg-[#f7eae5] px-3 py-2 text-xs text-[#914937]">{itemError}</p> : null}
          <p className="-mt-1 text-[10px] leading-5 text-[#929388]">Use um link público para a imagem. O arquivo fica associado à peça no seu closet.</p>
          <button type="submit" disabled={pendingAction === "item"} className="mt-2 flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-wait disabled:opacity-60">{pendingAction === "item" ? <><LoaderCircle size={15} className="animate-spin" />Salvando…</> : <><Check size={15} />{editingItem ? "Salvar alterações" : "Adicionar ao closet"}</>}</button>
        </form>
      </Modal> : null}

      {authModal ? <Modal title={registering ? "Seu estilo começa aqui." : "Que bom ter você de volta."} onClose={() => { setAuthModal(false); setAuthError(""); }}>
        <p className="-mt-3 mb-6 text-sm text-[#7e8176]">{registering ? "Crie sua conta para guardar suas peças e looks." : "Entre para acessar seu closet de qualquer lugar."}</p>
        <form onSubmit={(event) => void submitAuth(event)} className="grid gap-4">{registering ? <Field label="Seu nome" name="name" autoComplete="name" required placeholder="Nome e sobrenome" /> : null}<Field label="E-mail" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" /><Field label="Senha" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={6} required placeholder="Mínimo de 6 caracteres" />{authError ? <p role="alert" className="border-l-2 border-[#c56750] bg-[#f7eae5] px-3 py-2 text-xs leading-5 text-[#914937]">{authError}</p> : null}<button type="submit" disabled={busy} className="mt-1 flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:opacity-60">{busy ? "Aguarde…" : registering ? "Criar minha conta" : "Entrar"}<ArrowRight size={15} /></button></form>
        <p className="mt-5 text-center text-xs text-[#85877d]">{registering ? "Já tem conta?" : "Primeira vez por aqui?"} <button type="button" onClick={() => { setRegistering((previous) => !previous); setAuthError(""); }} className="font-semibold text-[#4f6b54] underline decoration-[#a6b5a4] underline-offset-2">{registering ? "Entrar" : "Criar conta"}</button></p>
        {!firebaseEnabled ? <p className="mt-4 border-t border-[#e6e4dc] pt-4 text-center text-[10px] leading-5 text-[#96978d]">Você está explorando o modo demonstração. A configuração de conta será habilitada quando o Firebase estiver conectado.</p> : null}
      </Modal> : null}

      {sharing ? <Modal title="Compartilhe seu jeito." onClose={() => setSharing(false)}><form onSubmit={(event) => void publishPost(event)} className="grid gap-4"><Field label="Imagem do look (URL)" type="url" name="imageUrl" required placeholder="https://..." /><label className="grid gap-2 text-xs font-semibold text-[#555d50]">Conte sobre esse look<textarea name="caption" required maxLength={400} rows={4} placeholder="De onde veio a inspiração?" className="resize-y border border-[#dfded7] bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#58725f]" /></label><p className="text-[10px] leading-5 text-[#929388]">Publicações ficam visíveis para membros autenticados da comunidade.</p><button type="submit" disabled={pendingAction === "post"} className="flex h-11 items-center justify-center gap-2 bg-[#314c3c] text-xs font-semibold text-white hover:bg-[#253b2d] disabled:cursor-wait disabled:opacity-60">{pendingAction === "post" ? <><LoaderCircle size={15} className="animate-spin" />Publicando…</> : <><Plus size={15} />Publicar no feed</>}</button></form></Modal> : null}
    </div>
  );
}
