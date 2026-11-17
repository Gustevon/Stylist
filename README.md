# Stylist

Guarda-roupa digital para organizar peças, criar looks e compartilhar combinações.

## Configuração

1. Copie `.env.example` para `.env.local` e preencha as credenciais do app Web Firebase.
2. No Firebase Authentication, habilite o provedor **E-mail/senha**.
3. Crie o Firestore e publique `firestore.rules`.
4. Execute `npm install` e `npm run dev`.

Sem as variáveis do Firebase, a aplicação informa que a configuração está indisponível e não usa dados de demonstração.

## Persistência e privacidade

- Perfil: `users/{uid}`.
- Peças e looks: `users/{uid}/clothes` e `users/{uid}/outfits`.
- Feed e comentários públicos para usuários autenticados: `community_posts` e sua subcoleção `comments`.
- Novas fotos do perfil e closet são otimizadas no navegador e salvas como Data URL nos respectivos documentos do Firestore, sem Firebase Storage. Arquivos de entrada podem ter até 10 MB; imagens finais são limitadas para respeitar o tamanho máximo dos documentos.

As regras Firestore restringem os dados de perfil, closet e looks ao proprietário. As publicações são acessíveis somente após autenticação.

## Comandos

- `npm run dev`: inicia o servidor local.
- `npm run lint`: executa ESLint.
- `npm run build`: gera a versão de produção.
