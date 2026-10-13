import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "permitase-fix-catalog-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // 1. Swap/Fix product_images storage_path and alt_text:
    // Product 6e51a03c-41bd-49d4-92d4-a8ef515cc1eb is Vibrador Porquinho Lilo Happy Pig (slug: lilo-happy-pig)
    // Its image should be the Lilo Happy Pig image (stored in 2b149e4a... folder)
    const { error: imgPigErr } = await supabase
      .from("product_images")
      .update({
        storage_path: "d0000000-0000-0000-0000-000000000001/2b149e4a-f4e2-4f21-8136-abba046c79e6/imagem.png",
        alt_text: "Vibrador Porquinho Lilo Happy Pig",
      })
      .eq("product_id", "6e51a03c-41bd-49d4-92d4-a8ef515cc1eb");

    if (imgPigErr) throw imgPigErr;

    // Product 2b149e4a-f4e2-4f21-8136-abba046c79e6 is Pênis Realista sem Vibração (slug: dildo-realista-tom-pele)
    // Its image should be the Realistic Penis image (stored in 6e51a03c... folder)
    const { error: imgPenisErr } = await supabase
      .from("product_images")
      .update({
        storage_path: "d0000000-0000-0000-0000-000000000001/6e51a03c-41bd-49d4-92d4-a8ef515cc1eb/imagem.png",
        alt_text: "Pênis Realista sem Vibração",
      })
      .eq("product_id", "2b149e4a-f4e2-4f21-8136-abba046c79e6");

    if (imgPenisErr) throw imgPenisErr;

    // 2. Update product data for Porquinho:
    const { error: prodPigErr } = await supabase
      .from("products")
      .update({
        name: "Vibrador Porquinho Lilo Happy Pig",
        price_cents: 6990,
        short_description: "Design lúdico e delicado com vibrações potentes e função lamber (licking). Estimulação clitoriana precisa com toque ultra-macio e aveludado.",
        description: "Charmoso, moderno e surpreendentemente potente, o Vibrador Porquinho Lilo Happy Pig une diversão e bem-estar íntimo em um formato compacto e discreto. Revestido em silicone cirúrgico de toque sedoso e aveludado, é seguro para a pele e agradável ao toque desde o primeiro contato.\n\nSeu motor potente oferece diferentes padrões e frequências de vibração com a inovadora função 'licking' (lambida), perfeita para explorar o clitóris, mamilos e outras zonas erógenas com precisão e sutileza. O design ergonômico cabe perfeitamente na palma da mão e facilita o manuseio.\n\nSilencioso, recarregável e discreto, ideal para levar na bolsa ou necessaire. Perfeito para quem busca autoconhecimento com leveza e prazer sem complicação.",
      })
      .eq("id", "6e51a03c-41bd-49d4-92d4-a8ef515cc1eb");

    if (prodPigErr) throw prodPigErr;

    // 3. Update product data for Pênis Realista sem Vibração:
    const { error: prodPenisErr } = await supabase
      .from("products")
      .update({
        name: "Pênis Realista sem Vibração",
        price_cents: 8990,
        short_description: "Anatomia realista em tom de pele com acabamento aveludado e ventosa aderente. Firmeza e flexibilidade ideais para sensações naturais e prazerosas.",
        description: "Desenvolvido para proporcionar uma sensação autêntica e envolvente, o Pênis Realista sem Vibração reproduz fielmente as formas e relevos da anatomia masculina. Fabricado em material hipoalergênico macio e flexível, ele oferece toque realista semelhante à pele humana (cyberskin), garantindo conforto e prazer prolongado.\n\nA base com ventosa ultra-aderente permite fixação firme em superfícies lisas para momentos a sós com as mãos livres, além de ser compatível com a maioria das cintas penianas (strap-on).\n\nHigiênico, seguro e fácil de higienizar. Recomenda-se o uso com lubrificante à base de água para o máximo conforto e deslizamento perfeito.",
      })
      .eq("id", "2b149e4a-f4e2-4f21-8136-abba046c79e6");

    if (prodPenisErr) throw prodPenisErr;

    // 4. Update Bullet / Happy Meeting
    const { error: prodBulletErr } = await supabase
      .from("products")
      .update({
        name: "Bullet Vibrador Happy Meeting",
        price_cents: 6990,
        short_description: "Formato anatômico compacto e potente. Foco preciso no clitóris e zonas erógenas com discrição e facilidade para levar a qualquer lugar.",
        description: "O Bullet Vibrador Happy Meeting é o acessório indispensável para quem valoriza praticidade, discrição e vibrações concentradas. Com formato anatômico em cápsula e ponta arredondada, ele direciona toda a força de vibração para pontos específicos como clitóris, mamilos e períneo.\n\nSeu tamanho compacto cabe discretamente no bolso ou na bolsa, sendo perfeito tanto para momentos solo quanto para preliminares picantes a dois. Controle intuitivo de velocidade e vibração com um único toque.\n\nMaterial liso, atóxico e fácil de higienizar. Potencialize as sensações combinando com seu lubrificante ou gel excitante favorito.",
      })
      .eq("slug", "massageador-happy-meeting-rosa");

    if (prodBulletErr) throw prodBulletErr;

    return NextResponse.json({
      success: true,
      message: "Products and images fixed successfully",
    });
  } catch (error: any) {
    console.error("Fix catalog error:", error);
    return NextResponse.json(
      { error: error.message || String(error) },
      { status: 500 }
    );
  }
}
