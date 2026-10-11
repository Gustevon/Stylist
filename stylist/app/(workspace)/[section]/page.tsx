import { notFound } from "next/navigation";
import type { Section } from "@/lib/stylist/types";

const sections: Section[] = ["closet", "looks", "feed", "perfil"];

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as Section)) notFound();

  return null;
}