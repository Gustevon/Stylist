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
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
  type User,
  type UserCredential,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, firebaseEnabled } from "@/lib/firebase";

const DEFAULT_PROFILE_PHOTO = "/default-avatar.svg";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateAccount: (name: string) => Promise<void>;
  changeEmail: (currentPassword: string, email: string) => Promise<void>;
  changePassword: (currentPassword: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function requireAuth() {
  if (!auth) throw new Error("Configure as variáveis NEXT_PUBLIC_FIREBASE para ativar sua conta.");
  return auth;
}

function authError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet e tente novamente.",
    "auth/operation-not-allowed": "O login por e-mail e senha não está habilitado no Firebase.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/user-disabled": "Esta conta está desativada.",
    "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
    "auth/wrong-password": "A senha atual está incorreta.",
    "auth/weak-password": "Escolha uma senha mais forte.",
    "auth/requires-recent-login": "Por segurança, entre novamente antes de alterar esse dado.",
  };

  return new Error(
    messages[code] ??
      (error instanceof Error ? error.message : "Não foi possível autenticar. Tente novamente."),
  );
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
      try {
        await signInWithEmailAndPassword(requireAuth(), email, password);
      } catch (error) {
        throw authError(error);
      }
    },
    async register(name, email, password) {
      const currentAuth = requireAuth();
      if (!db) throw new Error("O Firestore não está configurado neste ambiente.");

      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Informe seu nome para criar a conta.");

      let credential: UserCredential;
      try {
        credential = await createUserWithEmailAndPassword(currentAuth, email, password);
      } catch (error) {
        throw authError(error);
      }

      try {
        await updateProfile(credential.user, {
          displayName: trimmedName,
          photoURL: DEFAULT_PROFILE_PHOTO,
        });
        await setDoc(doc(db, "users", credential.user.uid), {
          name: trimmedName,
          email: credential.user.email ?? email,
          bio: "",
          photoURL: DEFAULT_PROFILE_PHOTO,
          stylePreferences: "",
          colorPalette: "",
          createdAt: Date.now(),
        });
      } catch (error) {
        try {
          await deleteUser(credential.user);
        } catch (cleanupError) {
          console.error("Não foi possível remover a conta após falha no cadastro.", cleanupError);
          throw new Error(
            "Não foi possível salvar seu perfil. A conta de autenticação foi criada; tente entrar novamente.",
          );
        }
        console.error("Não foi possível criar o perfil no Firestore.", error);
        const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
          ? error.code
          : "";
        throw new Error(
          code === "permission-denied"
            ? "O Firestore recusou criar seu perfil. Publique as regras de firestore.rules no Firebase e tente novamente."
            : "Não foi possível concluir seu cadastro. Confira a conexão e tente novamente.",
        );
      }
      setUser(credential.user);
    },
    async logout() {
      await signOut(requireAuth());
    },
    async updateAccount(name) {
      const currentAuth = requireAuth();
      if (!currentAuth.currentUser) throw new Error("Entre na sua conta para atualizar o perfil.");
      await updateProfile(currentAuth.currentUser, {
        displayName: name,
      });
      setAccountVersion((version) => version + 1);
    },
    async changeEmail(currentPassword, email) {
      const currentAuth = requireAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser?.email) throw new Error("Entre na sua conta para atualizar o e-mail.");
      try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updateEmail(currentUser, email.trim());
        setAccountVersion((version) => version + 1);
      } catch (error) {
        throw authError(error);
      }
    },
    async changePassword(currentPassword, password) {
      const currentAuth = requireAuth();
      const currentUser = currentAuth.currentUser;
      if (!currentUser?.email) throw new Error("Entre na sua conta para atualizar a senha.");
      try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, password);
      } catch (error) {
        throw authError(error);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
