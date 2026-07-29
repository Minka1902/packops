// ─── Business pages, attached to the modules that own them ────────────────────
// The business CRM used to describe every page three times: a nav entry in
// lib/nav.ts gated by a legacy `BusinessModule`, a route in router/index.tsx,
// and a capability in the permission catalog. This file is the single place a
// page is declared; registry.ts merges it onto the matching manifest, so nav,
// routes, unlock state and permissions all follow from the module id.
//
// Several modules own more than one page — the v2 model deliberately absorbed
// related legacy modules (shop ← orders + services, messaging ← messages +
// report cards, inventory ← inventory + purchasing, workforce ← shifts +
// payroll, invoicing ← invoices + expenses). See ID_TO_LEGACY_MODULES.
//
// Routes are relative to /business and use lazy thunks, so importing this file
// does not pull in any page code.

import {
  BarChart3, BedDouble, CalendarClock, FileHeart, FileSignature,
  GraduationCap, HeartHandshake, MessageSquare, Package, PackagePlus, PawPrint,
  Receipt, Scissors, ShoppingCart, Stethoscope, Tags, Ticket, Truck, Users,
  Wallet, Banknote,
} from 'lucide-react';
import type { ModuleId } from './ids';
import type { NavItemDef, RouteDef } from './types';

const page = (path: string, load: () => Promise<{ default: React.ComponentType<unknown> }>): RouteDef => ({
  path,
  lazy: () => load().then((m) => ({ Component: m.default })),
});

export interface ModulePages {
  navItems?: NavItemDef[];
  routes?: RouteDef[];
}

export const BUSINESS_MODULE_PAGES: Partial<Record<ModuleId, ModulePages>> = {
  clients: {
    navItems: [{ to: '/business/customers', label: 'Customers', icon: Users, level: 'read' }],
    routes: [page('customers', () => import('@/features/business/pages/CustomersPage'))],
  },

  appointments: {
    navItems: [{ to: '/business/appointments', label: 'Appointments', icon: CalendarClock, level: 'read' }],
    routes: [page('appointments', () => import('@/features/business/pages/AppointmentsPage'))],
  },

  grooming: {
    navItems: [{ to: '/business/grooming', label: 'Grooming', icon: Scissors, level: 'read' }],
    routes: [page('grooming', () => import('@/features/business/pages/GroomingPage'))],
  },

  // orders + services
  shop: {
    navItems: [
      { to: '/business/orders', label: 'Orders', icon: ShoppingCart, level: 'read' },
      { to: '/business/services', label: 'Services', icon: Tags, level: 'read' },
    ],
    routes: [
      page('orders', () => import('@/features/business/pages/OrdersPage')),
      page('services', () => import('@/features/business/pages/ServicesPage')),
    ],
  },

  boarding: {
    navItems: [{ to: '/business/boarding', label: 'Boarding', icon: BedDouble, level: 'read' }],
    routes: [page('boarding', () => import('@/features/business/pages/BoardingPage'))],
  },

  // messages + report cards
  messaging: {
    navItems: [
      { to: '/business/messages', label: 'Messages', icon: MessageSquare, level: 'read' },
      { to: '/business/report-cards', label: 'Report cards', icon: FileHeart, level: 'read' },
    ],
    routes: [
      page('messages', () => import('@/features/business/pages/MessagesPage')),
      page('report-cards', () => import('@/features/business/pages/ReportCardsPage')),
    ],
  },

  memberships: {
    navItems: [{ to: '/business/packages', label: 'Packages', icon: Ticket, level: 'read' }],
    routes: [page('packages', () => import('@/features/business/pages/PackagesPage'))],
  },

  documents: {
    navItems: [{ to: '/business/waivers', label: 'Waivers', icon: FileSignature, level: 'read' }],
    routes: [page('waivers', () => import('@/features/business/pages/WaiversPage'))],
  },

  veterinary: {
    navItems: [{ to: '/business/patients', label: 'Patients', icon: Stethoscope, level: 'read' }],
    routes: [
      page('patients', () => import('@/features/business/pages/PatientsPage')),
      page('patients/:petId', () => import('@/features/business/pages/PatientChartPage')),
    ],
  },

  events: {
    navItems: [{ to: '/business/classes', label: 'Classes', icon: GraduationCap, level: 'read' }],
    routes: [page('classes', () => import('@/features/business/pages/ClassesPage'))],
  },

  rescue: {
    navItems: [{ to: '/business/adoptions', label: 'Adoptions', icon: HeartHandshake, level: 'read' }],
    routes: [page('adoptions', () => import('@/features/business/pages/AdoptionsPage'))],
  },

  breeding: {
    navItems: [{ to: '/business/breeding', label: 'Litters', icon: PawPrint, level: 'read' }],
    routes: [page('breeding', () => import('@/features/business/pages/BreedingPage'))],
  },

  // invoices + expenses
  invoicing: {
    navItems: [
      { to: '/business/invoices', label: 'Invoices', icon: Receipt, level: 'read' },
      { to: '/business/expenses', label: 'Expenses', icon: Wallet, level: 'read' },
    ],
    routes: [
      page('invoices', () => import('@/features/business/pages/InvoicesPage')),
      page('expenses', () => import('@/features/business/pages/ExpensesPage')),
    ],
  },

  // inventory + purchasing
  inventory: {
    navItems: [
      { to: '/business/inventory', label: 'Stock', icon: Package, level: 'read' },
      { to: '/business/purchasing', label: 'Purchasing', icon: PackagePlus, level: 'read' },
    ],
    routes: [
      page('inventory', () => import('@/features/business/pages/InventoryPage')),
      page('purchasing', () => import('@/features/business/pages/PurchasingPage')),
    ],
  },

  deliveries: {
    navItems: [{ to: '/business/shipments', label: 'Shipments', icon: Truck, level: 'read' }],
    routes: [page('shipments', () => import('@/features/business/pages/ShipmentsPage'))],
  },

  // shifts + payroll
  workforce: {
    navItems: [
      { to: '/business/shifts', label: 'Shifts', icon: CalendarClock, level: 'read' },
      { to: '/business/payroll', label: 'Payroll', icon: Banknote, level: 'read' },
    ],
    routes: [
      page('shifts', () => import('@/features/business/pages/ShiftsPage')),
      page('payroll', () => import('@/features/business/pages/PayrollPage')),
    ],
  },

  analytics: {
    navItems: [{ to: '/business/reports', label: 'Reports', icon: BarChart3, level: 'read' }],
    routes: [page('reports', () => import('@/features/business/pages/ReportsPage'))],
  },
};

