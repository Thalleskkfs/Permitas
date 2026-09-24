import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Em dev o servidor só aceita, por padrão, o host com que subiu ("localhost") — abrir
  // por "127.0.0.1" faz o socket de HMR falhar e, nesta versão do Next, isso derruba a
  // hidratação da página inteira (nada reage a clique). "127.0.0.1" cobre esse acesso.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // Padrão do Next é 1 MB; o bucket aceita até 5 MB por foto, e o seletor de
      // imagens permite várias de uma vez (produto novo e "Selecionar imagens" na
      // edição). 20 MB cobre um lote de até 4 fotos no teto sem abrir demais o corpo
      // aceito por uma ação que já exige sessão de administrador.
      bodySizeLimit: "20mb",
    },
  },
  images: {
    // O otimizador só processa as duas origens de imagem que existem: a rota que serve
    // o catálogo a partir do bucket privado e os arquivos da marca. Qualquer outro
    // caminho local é recusado, em vez de o otimizador aceitar o que vier.
    localPatterns: [{ pathname: "/imagens/**" }, { pathname: "/marca/**" }],
  },
  async redirects() {
    // A área administrativa passou de /dashboard para /admin. O destino é protegido
    // pelo mesmo guarda, então o redirect não expõe nada.
    return [
      { source: "/dashboard", destination: "/admin", permanent: true },
      { source: "/dashboard/:path*", destination: "/admin/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
