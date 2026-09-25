-- Descrição da loja: até aqui só service_role podia gravar (grant herdado do momento em
-- que a coluna foi criada, sem uma tela de edição ainda). Ela aparece em toda página da
-- vitrine — <meta description>, cartão de prévia do WhatsApp/Instagram — e hoje só existe
-- o texto de fallback do código ("Plataforma de catálogo de produtos."), porque não havia
-- como o painel gravar um texto de verdade. A policy stores_update_owner já existe e já
-- restringe a linha ao dono da loja; falta só liberar a coluna para quem a policy deixa
-- passar.
grant update (description) on public.stores to authenticated;
