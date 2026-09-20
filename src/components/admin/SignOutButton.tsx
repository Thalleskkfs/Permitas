import { signOutAction } from "@/modules/auth/actions";
import { buttonClass } from "@/components/dashboard/ui";

export function SignOutButton({ label = "Sair", className }: { label?: string; className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? buttonClass("outline", "w-full")}>
        {label}
      </button>
    </form>
  );
}
