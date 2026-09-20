import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { FormSection } from "@/components/dashboard/FormSection";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { Field, ImagePlaceholder, ToggleField, buttonClass, inputClass } from "@/components/dashboard/ui";

const COLORS = [
  { name: "primary", label: "Primária", value: "#171717" },
  { name: "background", label: "Fundo", value: "#ffffff" },
  { name: "foreground", label: "Texto", value: "#171717" },
  { name: "muted", label: "Superfície", value: "#f4f4f5" },
];

const FONTS = ["Sistema (padrão)", "Inter", "Geist", "Roboto", "Lora"];

export default function AparenciaPage() {
  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Aparência"
        description="Identidade visual aplicada à vitrine da loja."
      />

      <SettingsForm>
        <FormSection title="Logo" description="Usado no cabeçalho da loja e no favicon.">
          <div className="flex flex-wrap items-center gap-4">
            <ImagePlaceholder alt="Logo atual da loja" className="size-16" />
            <div className="flex gap-2">
              <button type="button" className={buttonClass("outline")}>
                Enviar logo
              </button>
              <button type="button" className={buttonClass("ghost")}>
                Remover
              </button>
            </div>
          </div>
        </FormSection>

        <FormSection title="Cores" description="Paleta aplicada à loja. O painel segue neutro.">
          <div className="grid gap-5 sm:grid-cols-2">
            {COLORS.map((color) => (
              <Field key={color.name} label={color.label} htmlFor={`color-${color.name}`}>
                <div className="flex items-center gap-3">
                  <input
                    id={`color-${color.name}`}
                    name={`color-${color.name}`}
                    type="color"
                    defaultValue={color.value}
                    className="focus-ring size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background"
                  />
                  <input
                    aria-label={`${color.label} em hexadecimal`}
                    name={`color-${color.name}-hex`}
                    defaultValue={color.value}
                    className={inputClass}
                  />
                </div>
              </Field>
            ))}
          </div>
        </FormSection>

        <FormSection title="Tipografia" description="Fonte e arredondamento dos elementos.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fonte" htmlFor="font-family">
              <select id="font-family" name="fontFamily" className={inputClass}>
                {FONTS.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </Field>
            <Field label="Arredondamento" htmlFor="radius" hint="Aplicado a botões, cards e imagens.">
              <select id="radius" name="radius" defaultValue="Médio" className={inputClass}>
                {["Nenhum", "Pequeno", "Médio", "Grande"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Cabeçalho" description="Barra superior da loja.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Layout" htmlFor="header-layout">
              <select id="header-layout" name="headerLayout" className={inputClass}>
                {["Logo à esquerda", "Logo centralizado", "Compacto"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
          </div>
          <ToggleField name="headerSticky" label="Cabeçalho fixo" description="Acompanha a rolagem da página." defaultChecked />
          <ToggleField name="headerSearch" label="Exibir busca no cabeçalho" />
        </FormSection>

        <FormSection title="Cards de produto" description="Como cada produto aparece nas listagens.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Proporção da imagem" htmlFor="card-ratio">
              <select id="card-ratio" name="cardRatio" defaultValue="Quadrada" className={inputClass}>
                {["Quadrada", "Retrato", "Paisagem"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Produtos por linha" htmlFor="card-columns">
              <select id="card-columns" name="cardColumns" defaultValue="4" className={inputClass}>
                {["2", "3", "4"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </Field>
          </div>
          <ToggleField name="cardBadge" label="Exibir etiqueta de promoção" defaultChecked />
        </FormSection>

        <FormSection title="Banner" description="Área de destaque no topo da página inicial.">
          <ToggleField name="bannerEnabled" label="Exibir banner" defaultChecked />
          <Field label="Título" htmlFor="banner-title">
            <input id="banner-title" name="bannerTitle" placeholder="Título de destaque" className={inputClass} />
          </Field>
          <Field label="Subtítulo" htmlFor="banner-subtitle">
            <input id="banner-subtitle" name="bannerSubtitle" placeholder="Mensagem curta" className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <ImagePlaceholder alt="Imagem do banner" className="h-16 w-28" />
            <button type="button" className={buttonClass("outline")}>
              Enviar imagem
            </button>
          </div>
        </FormSection>

        <FormSection title="Rodapé" description="Informações exibidas no fim da loja.">
          <Field label="Texto do rodapé" htmlFor="footer-text">
            <textarea id="footer-text" name="footerText" rows={3} className={inputClass} />
          </Field>
          <ToggleField name="footerSocial" label="Exibir redes sociais" />
        </FormSection>
      </SettingsForm>
    </DashboardContainer>
  );
}
