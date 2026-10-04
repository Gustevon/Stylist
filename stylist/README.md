# Stylist

Guarda-roupa digital para organizar peças, criar looks e compartilhar combinações.

## Configuração Firebase

Sem credenciais, o app abre em modo de demonstração. Para habilitar Auth e Firestore, defina `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` e `NEXT_PUBLIC_FIREBASE_APP_ID` no ambiente local. Ative Email/senha no Firebase Authentication e publique `firestore.rules`.

O perfil, as peças e os looks ficam sob `users/{uid}`; as regras impedem que outra conta leia ou altere esses documentos. Publicações e comentários são visíveis a usuários autenticados. Imagens são guardadas como URLs; uploads diretos exigem Firebase Storage e regras próprias.

## Estrutura

- `app/`: rota e layout do App Router.
- `features/stylist/`: experiência principal e fluxos do produto.
- `lib/firebase/`: inicialização do Firebase no cliente.
- `lib/stylist/`: tipos, dados de demonstração e persistência Firestore.
- `firestore.rules`: regras de isolamento e permissões do feed.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
