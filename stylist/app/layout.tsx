import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stylist | Seu guarda-roupa, com intenção",
  description: "Organize suas peças, crie looks e compartilhe seu estilo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
