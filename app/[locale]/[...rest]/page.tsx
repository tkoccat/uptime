import { notFound } from "next/navigation";

// Tanımsız tüm adresler dil düzeni içindeki 404 sayfasına düşer (next-intl'in önerdiği kalıp)
export default function CatchAll() {
  notFound();
}
