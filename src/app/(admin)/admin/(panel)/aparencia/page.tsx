import { redirect } from "next/navigation";

// A antiga tela de aparência era só ilustrativa (a paleta da loja é fixa). O que o
// painel configura de fato na vitrine são os banners.
export default function AparenciaPage() {
  redirect("/admin/banners");
}
