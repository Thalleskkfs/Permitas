"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { CAPTCHA_ENABLED, TURNSTILE_SITE_KEY } from "@/config/auth";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Widget do Cloudflare Turnstile. O token vai no campo `captchaToken` e quem o valida é
 * o Supabase Auth, com a secret cadastrada no painel dele. Nada é verificado aqui.
 *
 * Sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, o componente não renderiza nada e o fluxo segue
 * sem captcha.
 */
export function CaptchaField() {
  const [token, setToken] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (renderedRef.current || !containerRef.current || !window.turnstile) return;
    renderedRef.current = true;

    window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, []);

  if (!CAPTCHA_ENABLED) return null;

  return (
    <div className="flex flex-col gap-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} />
      <input type="hidden" name="captchaToken" value={token} />
    </div>
  );
}
