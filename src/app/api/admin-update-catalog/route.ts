import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("x-admin-token");
    if (authHeader !== "permita-se-secret-update-2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 1. Atualizar Plugs com Joia e cadastrar variantes
    const plugUpdates = {
      name: "Plug Anal com Joia",
      price_cents: 4990,
      short_description: "Design anatômico em metal espelhado com base decorada por pedra brilhante. Conforto térmico, suavidade e sofisticação para momentos especiais.",
      description: "O Plug Anal com Joia combina elegância visual e estimulação intensa. Confeccionado em liga metálica de alta qualidade com acabamento polido ultra-suave, ele proporciona uma introdução confortável e toque frio estimulante, adaptando-se rapidamente à temperatura do corpo.\n\nSua ponta cônica facilita a inserção gradual e seu corpo ergonômico garante retenção segura. A base decorada com uma joia delicadamente lapidada traz um visual luxuoso e sensual, além de garantir total segurança durante o uso.\n\nDisponível nos tamanhos P, M e G para acompanhar seu momento com perfeição, desde as primeiras sensações até experiências mais completas. Higiênico, durável e fácil de limpar. Recomenda-se o uso com lubrificante à base de água.",
    };

    const { data: plugProduct, error: plugErr } = await supabase
      .from("products")
      .update(plugUpdates)
      .eq("slug", "plug-anal-com-joia")
      .select("id, store_id")
      .single();

    if (plugErr) throw plugErr;

    // Remove variantes existentes se houver e insere P, M, G
    await supabase.from("product_variants").delete().eq("product_id", plugProduct.id);

    const variantsToInsert = [
      {
        store_id: plugProduct.store_id,
        product_id: plugProduct.id,
        name: "Plug com Joia P",
        price_cents: 4990,
        stock: 10,
        options: { Tamanho: "P" },
        active: true,
        position: 0,
      },
      {
        store_id: plugProduct.store_id,
        product_id: plugProduct.id,
        name: "Plug com Joia M",
        price_cents: 6990,
        stock: 10,
        options: { Tamanho: "M" },
        active: true,
        position: 1,
      },
      {
        store_id: plugProduct.store_id,
        product_id: plugProduct.id,
        name: "Plug com Joia G",
        price_cents: 8990,
        stock: 10,
        options: { Tamanho: "G" },
        active: true,
        position: 2,
      },
    ];

    const { error: variantErr } = await supabase.from("product_variants").insert(variantsToInsert);
    if (variantErr) throw variantErr;

    // 2. Dildo Realista com Ventosa
    await supabase
      .from("products")
      .update({
        name: "Dildo Realista com Ventosa",
        price_cents: 9990,
        short_description: "Textura aveludada com toque de pele natural, veias em relevo e ventosa ultra-aderente para fixação prática em superfícies lisas.",
        description: "Desenvolvido para proporcionar uma sensação autêntica e envolvente, o Dildo Realista com Ventosa reproduz fielmente as formas e relevos da anatomia masculina. Fabricado em material hipoalergênico macio e flexível, ele oferece toque realista semelhante à pele humana (cyberskin), garantindo conforto e prazer prolongado.\n\nA ventosa de alta pressão na base permite fixação estável e firme em qualquer superfície lisa (azulejos, piso, portas ou cadeiras), proporcionando liberdade de movimentos para explorar novas posições e sensações solo ou em casal. Também é compatível com cintas ergonômicas strap-on.\n\nFácil de higienizar e 100% seguro para o corpo. Use sempre acompanhado de lubrificante à base de água para deslize suave e confortável.",
      })
      .eq("slug", "dildo-realista-com-ventosa");

    // 3. Pênis Realista sem Vibração (slug dildo-realista-tom-pele)
    await supabase
      .from("products")
      .update({
        name: "Pênis Realista sem Vibração",
        price_cents: 8990,
        short_description: "Anatomia realista em tom de pele com acabamento aveludado. Firmeza e flexibilidade ideais para sensações naturais e prazerosas.",
        description: "O Pênis Realista sem Vibração é a escolha clássica para quem busca preenchimento confortável e estímulo puramente mecânico e natural. Esculpido com detalhes anatômicos ricos, incluindo glande definida e veias em relevo suave, ele simula com perfeição o toque e a flexibilidade do corpo humano.\n\nSeu material de toque macio não agride a mucosa e proporciona uma experiência sensorial realista e envolvente. Ideal para práticas solo ou para apimentar a intimidade a dois com novas dinâmicas.\n\nLivre de ftalatos e seguro para a saúde íntima. Recomenda-se a utilização com lubrificante à base de água e higienização com água morna e sabonete neutro.",
      })
      .eq("slug", "dildo-realista-tom-pele");

    // 4. Porquinho Vibrador (slug lilo-happy-pig)
    await supabase
      .from("products")
      .update({
        name: "Porquinho Vibrador Lilo",
        price_cents: 6990,
        short_description: "Design lúdico e delicado com vibrações potentes e silenciosas. Estimulação clitoriana e de pontos sensíveis com toque ultra-macio.",
        description: "Charmoso, moderno e surpreendentemente potente, o Porquinho Vibrador Lilo une diversão e bem-estar íntimo em um formato compacto e discreto. Revestido em silicone cirúrgico de toque sedoso e aveludado, é seguro para a pele e agradável ao toque desde o primeiro contato.\n\nSeu motor potente oferece diferentes padrões e frequências de vibração, perfeitos para explorar o clitóris, mamilos e outras zonas erógenas com precisão e sutileza. O design ergonômico cabe perfeitamente na palma da mão e facilita o manuseio.\n\nSilencioso e discreto, ideal para levar na bolsa ou necessaire. Perfeito para quem busca autoconhecimento com leveza e prazer sem complicação.",
      })
      .eq("slug", "lilo-happy-pig");

    // 5. Capa Peniana Extreme Cyberskin
    await supabase
      .from("products")
      .update({
        name: "Capa Peniana Extreme Cyberskin",
        price_cents: 5990,
        short_description: "Prolonga a ereção, adiciona espessura e intensidade com textura de relevos estimulantes. Material elástico e de adaptação perfeita.",
        description: "A Capa Peniana Extreme foi projetada para transformar e potencializar o prazer de ambos na relação a dois. Produzida em Cyberskin ultra-elástico e maleável, ela se ajusta perfeitamente ao pênis, proporcionando aumento perceptível de espessura e comprimento.\n\nA textura externa conta com relevos e ondulações estrategicamente posicionados para intensificar o atrito e a estimulação das paredes vaginais, promovendo sensações intensas para a parceria. Ao mesmo tempo, sua compressão suave auxilia na manutenção da firmeza por mais tempo.\n\nToque macio, lavável e reutilizável. Para melhor experiência e facilidade ao vestir, utilize sempre com lubrificante à base de água.",
      })
      .eq("slug", "capa-peniana-extreme-cyberskin");

    // 6. Estimulador de Sucção Liab
    await supabase
      .from("products")
      .update({
        name: "Estimulador de Sucção Clitoriano Liab",
        price_cents: 6990,
        short_description: "Ondas de pulsação e pressão de ar sem contato direto. Estimulação profunda para orgasmos intensos e múltiplos em poucos minutos.",
        description: "Revolucione sua rotina de bem-estar com o Estimulador de Sucção Clitoriano Liab. Utilizando tecnologia avançada de ondas de pressão e pulsação suave por fluxo de ar, ele envolve o clitóris sem atrito excessivo, estimulando as terminações nervosas mais profundas e evitando a perda de sensibilidade.\n\nCom múltiplos níveis e intensidades ajustáveis, permite navegar desde carícias sutis até pulsos estimulantes que conduzem a orgasmos rápidos, múltiplos e profundos. Seu bocal ergonômico em silicone hipoalergênico se molda com conforto e suavidade.\n\nDiscreto, recarregável e silencioso, é o companheiro perfeito para momentos de relaxamento e conexão com seu próprio corpo.",
      })
      .eq("slug", "estimulador-de-succao-liab");

    // 7. Vibrador Rabbit Pink & Roxo
    const rabbitDesc = {
      price_cents: 7990,
      short_description: "O clássico mais desejado: dupla estimulação simultânea do ponto G e do clitóris com múltiplos modos de vibração e toque aveludado.",
      description: "O Vibrador Rabbit é um ícone mundial do prazer por um motivo simples: ele proporciona estimulação dupla e simultânea com perfeição absoluta. Sua haste curva alcança e massageia internamente o ponto G, enquanto as orelhas flexíveis acariciam o clitóris com pulsações contínuas.\n\nEquipado com múltiplos estágios e ritmos de vibração, ele permite criar combinações personalizadas para atingir novos patamares de prazer. Confeccionado em silicone macio de alta densidade, desliza facilmente e oferece toque macio e confortável.\n\nFácil de manusear através de comandos intuitivos na base. Recomenda-se o uso com lubrificante à base de água para uma experiência sublime.",
    };

    await supabase.from("products").update(rabbitDesc).eq("slug", "vibrador-rabbit-pink");
    await supabase.from("products").update(rabbitDesc).eq("slug", "vibrador-rabbit-roxo");

    // 8. Bullet Vibrador (slug massageador-happy-meeting-rosa)
    await supabase
      .from("products")
      .update({
        name: "Bullet Vibrador Happy Meeting",
        price_cents: 6990,
        short_description: "Formato cápsula ultra-compacto e potente. Foco preciso no clitóris e zonas erógenas com discrição e facilidade para levar a qualquer lugar.",
        description: "O Bullet Vibrador Happy Meeting é o acessório indispensável para quem valoriza praticidade, discrição e vibrações concentradas. Com formato anatômico em cápsula e ponta arredondada, ele direciona toda a força de vibração para pontos específicos como clitóris, mamilos e períneo.\n\nSeu tamanho compacto cabe discretamente no bolso ou na bolsa, sendo perfeito tanto para momentos solo quanto para preliminares picantes a dois. Controle intuitivo de velocidade e vibração com um único toque.\n\nMaterial liso, atóxico e fácil de higienizar. Potencialize as sensações combinando com seu lubrificante ou gel excitante favorito.",
      })
      .eq("slug", "massageador-happy-meeting-rosa");

    // 9. Lubrificantes Comfort Lub LA Pimienta
    const comfortLubDesc = {
      price_cents: 4990,
      short_description: "À base de água, toque sedoso e aroma irresistível. Deslize duradouro, não mancha tecidos e é seguro com preservativos e brinquedos.",
      description: "A linha de Lubrificantes Comfort Lub La Pimienta 120ml foi desenvolvida para proporcionar máximo conforto, hidratação e prazer sensorial. Sua fórmula à base de água garante um deslizamento suave e duradouro, eliminando qualquer atrito ou desconforto durante a relação.\n\nCom aromas deliciosos e sabor suave, ele transforma as preliminares e o sexo oral em uma experiência envolvente e estimulante para todos os sentidos. Não é pegajoso, não agride o pH íntimo e sai facilmente com água, sem deixar resíduos nem manchar lençóis ou roupas.\n\n100% seguro para uso com preservativos de látex e com qualquer tipo de brinquedo íntimo (silicone, metal ou vidro). Aplique a quantidade desejada e sinta a diferença no toque.",
    };

    const comfortLubSlugs = [
      "lubrificante-comfort-lub-la-pimienta-algodao-doce-120ml",
      "lubrificante-comfort-lub-la-pimienta-cereja-120ml",
      "lubrificante-comfort-lub-la-pimienta-morango-champagne-120ml",
      "lubrificante-comfort-lub-la-pimienta-caramelo-120ml",
      "lubrificante-comfort-lub-la-pimienta-menta-120ml",
      "lubrificante-comfort-lub-la-pimienta-morango-120ml",
    ];

    for (const slug of comfortLubSlugs) {
      await supabase.from("products").update(comfortLubDesc).eq("slug", slug);
    }

    return NextResponse.json({ success: true, message: "Catalog updated successfully" });
  } catch (error: any) {
    console.error("Update error:", error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
