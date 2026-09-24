export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 xl:max-w-7xl xl:px-10 2xl:max-w-[88rem] ${className ?? ""}`}>{children}</div>
  );
}
