import { ChatIcon } from "./icons";

type WhatsAppButtonProps = {
  label?: string;
  href?: string;
  disabled?: boolean;
};

const styles =
  "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export function WhatsAppButton({
  label = "Comprar pelo WhatsApp",
  href,
  disabled = false,
}: WhatsAppButtonProps) {
  if (href && !disabled) {
    return (
      <a href={href} className={styles}>
        <ChatIcon />
        {label}
      </a>
    );
  }

  return (
    <button type="button" disabled={disabled} className={styles}>
      <ChatIcon />
      {label}
    </button>
  );
}
