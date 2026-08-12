import {
  Activity, ArrowUpDown, Bell, BookOpenText, Boxes, Briefcase, Calendar, CalendarCog, CalendarDays,
  CircleHelp, Settings,
  ChartColumn, ChartPie, ClipboardCheck, ClipboardList, Clock, Cog, Construction, Droplets, Eye,
  FileCheck, FileSearch, FileText, FlaskConical, Flame, FolderKanban, FolderOpen, Gauge, Gavel,
  GraduationCap, HardHat, History, House, LayoutDashboard, Leaf, LifeBuoy, List, ListChecks,
  ListOrdered, MessagesSquare, Recycle, RefreshCw, Scale, SearchCheck, ShieldAlert, Siren,
  SquareStack, TriangleAlert, Truck, Users, Zap,
} from 'lucide-angular';

/** Shape of a lucide icon as consumed by <lucide-icon [img]="...">. */
export type IconType = readonly unknown[] | any;

/**
 * A navigable page. `route` is the canonical absolute path — it is what the active
 * route is matched against, and what itemLink() turns into router segments.
 * `permissions` is honoured by the filter in SidebarStateService; the project has no
 * permission source today, so leaving it undefined means "always visible".
 */
export interface NavigationItem {
  id: string;
  label: string;
  route: string;
  icon?: IconType;
  permissions?: string[];
  badge?: string;
  disabled?: boolean;
}

/** A module shown as one icon on the primary rail. */
export interface NavigationModule {
  id: string;
  label: string;
  description?: string;
  icon: IconType;
  defaultRoute?: string;
  permissions?: string[];
  items: NavigationItem[];
}

/**
 * The single source of truth for navigation. The primary rail reads the modules,
 * the secondary panel reads the items of the active module — routes are declared
 * once, here, and never duplicated between the two.
 *
 * Every route below already exists in app.routes.ts: the eight explicit paths plus
 * the generic /sheet/:sheet page. No route is invented.
 */
export const NAVIGATION: NavigationModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Dashboards and entry points',
    icon: LayoutDashboard,
    defaultRoute: '/home',
    items: [
      { id: 'home', label: 'Home', route: '/home', icon: House },
      { id: 'instructions', label: 'Instructions', route: '/instructions', icon: BookOpenText },
      { id: 'agent-inspector', label: 'Agent Inspector', route: '/agent-inspector', icon: Activity, badge: 'Demo' },
      { id: 'portfolio', label: 'Portfolio Dashboard', route: '/portfolio', icon: ChartPie },
      { id: 'project', label: 'Project Dashboard', route: '/project', icon: Gauge },
    ],
  },
  {
    id: 'core-data',
    label: 'Core Data',
    description: 'Projects, lists and manpower',
    icon: ClipboardList,
    defaultRoute: '/projects',
    items: [
      { id: 'lists', label: 'Lists', route: '/lists', icon: List },
      { id: 'project-register', label: 'Project Register', route: '/projects', icon: FolderKanban },
      { id: 'manpower-log', label: 'Manpower Log', route: '/sheet/Manpower Log', icon: Clock },
      { id: 'dashboard-data-engine', label: 'Dashboard Data Engine', route: '/sheet/Dashboard Data Engine', icon: Cog },
    ],
  },
  {
    id: 'incidents-risk',
    label: 'Incidents & Risk',
    description: 'Incidents, risk and corrective actions',
    icon: ShieldAlert,
    defaultRoute: '/sheet/Incident Register',
    items: [
      { id: 'incident-register', label: 'Incident Register', route: '/sheet/Incident Register', icon: TriangleAlert },
      { id: 'investigation-rca', label: 'Investigation & RCA', route: '/sheet/Investigation & RCA', icon: SearchCheck },
      { id: 'action-tracker', label: 'Action Tracker (CAPA)', route: '/sheet/Action Tracker (CAPA)', icon: ListChecks },
      { id: 'hira-register', label: 'HIRA Register', route: '/sheet/HIRA Register', icon: Zap },
      { id: 'jsa-log', label: 'JSA Log', route: '/sheet/JSA Log', icon: FileText },
      { id: 'jsa-steps', label: 'JSA Steps Detail', route: '/sheet/JSA Steps Detail', icon: ListOrdered },
      { id: 'permit-to-work', label: 'Permit to Work Register', route: '/sheet/Permit to Work Register', icon: FileCheck },
      { id: 'safety-observations', label: 'Safety Observations (BBS)', route: '/sheet/Safety Observations (BBS)', icon: Eye },
      { id: 'toolbox-talks', label: 'Toolbox Talks', route: '/sheet/Toolbox Talks', icon: MessagesSquare },
    ],
  },
  {
    id: 'people',
    label: 'People',
    description: 'Training, PPE and contractors',
    icon: Users,
    defaultRoute: '/sheet/Training & Competency',
    items: [
      { id: 'training', label: 'Training & Competency', route: '/sheet/Training & Competency', icon: GraduationCap },
      { id: 'ppe-register', label: 'PPE Register', route: '/sheet/PPE Register', icon: HardHat },
      { id: 'contractor-management', label: 'Contractor Management', route: '/sheet/Contractor Management', icon: Briefcase },
    ],
  },
  {
    id: 'inspections-assets',
    label: 'Inspections & Assets',
    description: 'Inspections, equipment and assets',
    icon: ClipboardCheck,
    defaultRoute: '/sheet/Site Inspection',
    items: [
      { id: 'site-inspection', label: 'Site Inspection', route: '/sheet/Site Inspection', icon: ClipboardCheck },
      { id: 'scaffold-inspection', label: 'Scaffold Inspection', route: '/sheet/Scaffold Inspection', icon: Construction },
      { id: 'lifting-inspection', label: 'Lifting Equipment Inspection', route: '/sheet/Lifting Equipment Inspection', icon: ArrowUpDown },
      { id: 'fire-inspection', label: 'Fire Equipment Inspection', route: '/sheet/Fire Equipment Inspection', icon: Flame },
      { id: 'vehicle-inspection', label: 'Vehicle & Plant Inspection', route: '/sheet/Vehicle & Plant Inspection', icon: Truck },
      { id: 'ladder-inspection', label: 'Ladder Inspection', route: '/sheet/Ladder Inspection', icon: SquareStack },
      { id: 'first-aid', label: 'First Aid & Emergency Equip.', route: '/sheet/First Aid & Emergency Equip.', icon: LifeBuoy },
      { id: 'equipment-register', label: 'Equipment & Plant Register', route: '/sheet/Equipment & Plant Register', icon: Boxes },
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    description: 'Waste, chemicals and monitoring',
    icon: Leaf,
    defaultRoute: '/sheet/Waste Management Log',
    items: [
      { id: 'waste-log', label: 'Waste Management Log', route: '/sheet/Waste Management Log', icon: Recycle },
      { id: 'chemical-inventory', label: 'Chemical Inventory & MSDS', route: '/sheet/Chemical Inventory & MSDS', icon: FlaskConical },
      { id: 'spill-incident', label: 'Spill Environmental Incident', route: '/sheet/Spill Environmental Incident', icon: Droplets },
      { id: 'env-monitoring', label: 'Environmental Monitoring', route: '/sheet/Environmental Monitoring', icon: Activity },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    description: 'Audits, compliance and documents',
    icon: Scale,
    defaultRoute: '/sheet/Audit Tracker',
    items: [
      { id: 'audit-tracker', label: 'Audit Tracker', route: '/sheet/Audit Tracker', icon: FileSearch },
      { id: 'legal-compliance', label: 'Legal Compliance Register', route: '/sheet/Legal Compliance Register', icon: Gavel },
      { id: 'management-of-change', label: 'Management of Change', route: '/sheet/Management of Change', icon: RefreshCw },
      { id: 'document-control', label: 'Document Control', route: '/sheet/Document Control', icon: FolderOpen },
      { id: 'meeting-minutes', label: 'Meeting Minutes', route: '/sheet/Meeting Minutes', icon: CalendarDays },
    ],
  },
  {
    id: 'planning-system',
    label: 'Planning & System',
    description: 'Emergency, KPIs and calendar',
    icon: CalendarCog,
    defaultRoute: '/sheet/Annual HSE Calendar',
    items: [
      { id: 'emergency-preparedness', label: 'Emergency Preparedness', route: '/sheet/Emergency Preparedness', icon: Siren },
      { id: 'kpi-engine', label: 'KPI Statistics Engine', route: '/sheet/KPI Statistics Engine', icon: ChartColumn },
      { id: 'annual-calendar', label: 'Annual HSE Calendar', route: '/sheet/Annual HSE Calendar', icon: Calendar },
      { id: 'change-log', label: 'Change Log', route: '/sheet/Change Log', icon: History },
    ],
  },
];

/**
 * Utility entries pinned to the foot of the rail, below the module list.
 * An item without `route` has no destination in the app yet — it renders muted
 * and inert rather than pretending to work.
 */
export interface UtilityItem {
  id: string;
  label: string;
  icon: IconType;
  route?: string;
}

export const UTILITY_ITEMS: UtilityItem[] = [
  { id: 'team', label: 'Team', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help Center', icon: CircleHelp, route: '/instructions' },
];

/**
 * Router segments for an item. Built from `route` so the path is declared once;
 * the segment array (rather than a string) lets the router encode names containing
 * spaces and parentheses, e.g. "Action Tracker (CAPA)".
 */
export function itemLink(item: NavigationItem): string[] {
  const path = item.route.replace(/^\//, '');
  const slash = path.indexOf('/');
  return slash === -1 ? ['/', path] : ['/', path.slice(0, slash), path.slice(slash + 1)];
}
