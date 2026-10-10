// Auto-generated from the system's Instructions index.
export interface NavItem { sheet: string; icon: string; route?: string | null; }
export interface NavGroup { group: string; icon: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  { group: "Overview", icon: "◆", items: [
    { sheet: "Home", icon: "⌂", route: "home" },
    { sheet: "Instructions", icon: "ℹ", route: "instructions" },
    { sheet: "Portfolio Dashboard", icon: "▣", route: "portfolio" },
    { sheet: "Project Dashboard", icon: "▶", route: "project" },
  ]},
  { group: "Core Data", icon: "▦", items: [
    { sheet: "Lists", icon: "☰", route: "lists" },
    { sheet: "Project Register", icon: "▦", route: "projects" },
    { sheet: "Manpower Log", icon: "⏱", route: null },
    { sheet: "Dashboard Data Engine", icon: "⚙", route: null },
  ]},
  { group: "Incidents & Risk", icon: "⚠", items: [
    { sheet: "Incident Register", icon: "⚠", route: null },
    { sheet: "Investigation & RCA", icon: "⌕", route: null },
    { sheet: "Action Tracker (CAPA)", icon: "✓", route: null },
    { sheet: "HIRA Register", icon: "⚡", route: null },
    { sheet: "JSA Log", icon: "✎", route: null },
    { sheet: "JSA Steps Detail", icon: "≡", route: null },
    { sheet: "Permit to Work Register", icon: "⚑", route: null },
    { sheet: "Safety Observations (BBS)", icon: "◎", route: null },
    { sheet: "Toolbox Talks", icon: "▴", route: null },
  ]},
  { group: "People", icon: "◎", items: [
    { sheet: "Training & Competency", icon: "△", route: null },
    { sheet: "PPE Register", icon: "◈", route: null },
    { sheet: "Contractor Management", icon: "▧", route: null },
  ]},
  { group: "Inspections & Assets", icon: "⌘", items: [
    { sheet: "Site Inspection", icon: "⌘", route: null },
    { sheet: "Scaffold Inspection", icon: "▤", route: null },
    { sheet: "Lifting Equipment Inspection", icon: "▲", route: null },
    { sheet: "Fire Equipment Inspection", icon: "◆", route: null },
    { sheet: "Vehicle & Plant Inspection", icon: "■", route: null },
    { sheet: "Ladder Inspection", icon: "◧", route: null },
    { sheet: "First Aid & Emergency Equip.", icon: "✚", route: null },
    { sheet: "Equipment & Plant Register", icon: "▩", route: null },
  ]},
  { group: "Environment", icon: "♻", items: [
    { sheet: "Waste Management Log", icon: "♻", route: null },
    { sheet: "Chemical Inventory & MSDS", icon: "⚗", route: null },
    { sheet: "Spill Environmental Incident", icon: "◍", route: null },
    { sheet: "Environmental Monitoring", icon: "◌", route: null },
  ]},
  { group: "Governance", icon: "⚖", items: [
    { sheet: "Audit Tracker", icon: "▥", route: null },
    { sheet: "Legal Compliance Register", icon: "⚖", route: null },
    { sheet: "Management of Change", icon: "↻", route: null },
    { sheet: "Document Control", icon: "◰", route: null },
    { sheet: "Meeting Minutes", icon: "◷", route: null },
  ]},
  { group: "Planning & System", icon: "□", items: [
    { sheet: "Emergency Preparedness", icon: "⛑", route: null },
    { sheet: "KPI Statistics Engine", icon: "▨", route: null },
    { sheet: "Annual HSE Calendar", icon: "□", route: null },
    { sheet: "Change Log", icon: "✍", route: null },
  ]},
];
