"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, firebaseEnabled } from "@/lib/firebase/client";

const DEFAULT_PROFILE_PHOTO = "/default-avatar.svg";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateAccount: (name: string, photoURL?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireAuth() {
  if (!auth) throw new Error("Configure as variáveis NEXT_PUBLIC_FIREBASE para ativar sua conta.");
  return auth;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [, setAccountVersion] = useState(0);

  useEffect(() => {
    if (!auth) {
      return;
    }

    return onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      (error) => {
        console.error("Não foi possível observar o estado de autenticação.", error);
        setLoading(false);
      },
    );
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    enabled: firebaseEnabled,
    async login(email, password) {
      await signInWithEmailAndPassword(requireAuth(), email, password);
    },
    async register(name, email, password) {
      const currentAuth = requireAuth();
      if (!db) throw new Error("O Firestore não está configurado neste ambiente.");

      const credential = await createUserWithEmailAndPassword(currentAuth, email, password);
      await updateProfile(credential.user, {
        displayName: name,
        photoURL: DEFAULT_PROFILE_PHOTO,
      });
      await setDoc(doc(db, "users", credential.user.uid), {
        name,
        email,
        bio: "",
        photoURL: DEFAULT_PROFILE_PHOTO,
        height: "",
        weight: "",
        stylePreferences: "",
        createdAt: Date.now(),
      });
      setUser(credential.user);
    },
    async logout() {
      await signOut(requireAuth());
    },
    async updateAccount(name, photoURL) {
      const currentAuth = requireAuth();
      if (!currentAuth.currentUser) throw new Error("Entre na sua conta para atualizar o perfil.");
      await updateProfile(currentAuth.currentUser, {
        displayName: name,
        ...(photoURL ? { photoURL } : {}),
      });
      setAccountVersion((version) => version + 1);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
