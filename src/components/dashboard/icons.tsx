import type { DashboardIconName } from "@/config/dashboard-nav";

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></Icon>
);
export const PackageIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></Icon>
);
export const FolderIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 6.5h5l2 2.5h10V19h-17Z" /></Icon>
);
export const TagIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 11V4h7l10 10-7 7-10-10Z" /><circle cx="7.5" cy="7.5" r="1.2" /></Icon>
);
export const LayersIcon = (p: IconProps) => (
  <Icon {...p}><path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /></Icon>
);
export const BoxIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="6.5" width="17" height="13" rx="1.5" /><path d="M3.5 11h17" /></Icon>
);
export const InboxIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17Z" /><path d="M3.5 13.5h4l1 2.5h7l1-2.5h4" /></Icon>
);
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 6.2a3 3 0 0 1 0 5.6M17 14.8c2 .6 3.5 2.4 3.5 4.7" /></Icon>
);
export const PaletteIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 2-1.8 0-1.6-1.6-1.6-1.6-3 0-1 .8-1.7 1.8-1.7h1.6a4.7 4.7 0 0 0 4.7-4.7C20.5 6.3 16.7 3.5 12 3.5Z" /><circle cx="8" cy="10" r="1.1" /><circle cx="12" cy="7.5" r="1.1" /></Icon>
);
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}><path d="m6 6 12 12M18 6 6 18" /></Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7" /></Icon>
);
export const ImageIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 15.5-5-5-8 8" /></Icon>
);
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const ChevronUpIcon = (p: IconProps) => <Icon {...p}><path d="m6 15 6-6 6 6" /></Icon>;
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const SwitchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 7h11l-3-3M17 17H6l3 3" /></Icon>
);

const NAV_ICONS: Record<DashboardIconName, (props: IconProps) => React.ReactElement> = {
  home: HomeIcon,
  package: PackageIcon,
  folder: FolderIcon,
  tag: TagIcon,
  layers: LayersIcon,
  box: BoxIcon,
  inbox: InboxIcon,
  users: UsersIcon,
  palette: PaletteIcon,
  image: ImageIcon,
  settings: SettingsIcon,
};

export function NavIcon({ name, className }: { name: DashboardIconName; className?: string }) {
  const Component = NAV_ICONS[name];
  return <Component className={className} />;
}
