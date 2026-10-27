import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  Eye,
  House,
  KeyRound,
  Layers2,
  ListChecks,
  Play,
  RotateCcw,
  ScanSearch,
  Settings2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** One outline icon vocabulary shared by route navigation and the menu dialog. */
export const navigationIcons = {
  home: House,
  test: ClipboardCheck,
  sim: CalendarClock,
  cards: Layers2,
  failures: Activity,
  reading: Eye,
  traps: ScanSearch,
  lightning: Zap,
  topics: ListChecks,
  stats: Activity,
  help: CircleHelp,
  settings: Settings2,
  access: KeyRound,
} satisfies Record<string, LucideIcon>;

export const menuActionIcons = {
  quick: Play,
  review: RotateCcw,
  errors: AlertTriangle,
  failures: CircleX,
} satisfies Record<string, LucideIcon>;
