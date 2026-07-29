// ─── Stub manifests ───────────────────────────────────────────────────────────
// Lightweight catalog entries for every not-yet-implemented module, so the
// Module Store is complete from day one. Carries only Store-visible fields
// (id/name/description/category/priceCents/deps/icon); routes, nav, dataModels
// and summaryView are added when a module is actually built. Data sourced from
// module&seed_plan.md Part B.

import {
  Users, CalendarClock, ShoppingBag, MapPin, MessageSquare, Calculator,
  ShoppingCart, Receipt, CreditCard, Wallet, Repeat, Ticket, Percent, Award,
  Package, Truck, Car, Clock, Scissors, BedDouble, Stethoscope, Dumbbell,
  Footprints, Dog, HeartHandshake, Heart, CalendarDays, Search, FileText,
  Star, LifeBuoy, Wrench, Shield, BarChart3, Building2,
} from 'lucide-react';
import type { ModuleManifest, StubManifestInput } from './types';

function stub(input: StubManifestInput): ModuleManifest {
  return {
    isDefaultUnlocked: false,
    lockable: true,
    permissions: ['read', 'write', 'action'],
    ...input,
  };
}

// 35 modules (the 2 core modules — staff, roles — have full manifests).
export const STUB_MANIFESTS: ModuleManifest[] = [
  // clients & operations
  stub({ id: 'clients', name: 'Clients & Pets', description: 'CRM for clients and their pet profiles.', category: 'operations', priceCents: 1990, dependencies: [], icon: Users }),
  stub({ id: 'appointments', name: 'Appointments & Scheduling', description: 'Resource-aware calendar, recurring bookings and waitlist.', category: 'operations', priceCents: 2490, dependencies: ['clients'], icon: CalendarClock }),

  // consumer front
  stub({ id: 'consumer', name: 'Get Something', description: 'Wolt-style consumer marketplace: browse, order, track, chat.', category: 'customer', priceCents: 4990, dependencies: ['shop', 'appointments'], icon: ShoppingBag, clientFacing: true }),
  stub({ id: 'tracking', name: 'Live Order & Service Tracking', description: 'Status pipelines, ETAs and live courier map.', category: 'customer', priceCents: 2990, dependencies: ['shop'], icon: MapPin, clientFacing: true }),
  stub({ id: 'messaging', name: 'Messaging & Notifications', description: 'Customer threads, visit updates and announcements.', category: 'customer', priceCents: 1990, dependencies: [], icon: MessageSquare, clientFacing: true }),

  // money in
  stub({ id: 'pos', name: 'Point of Sale', description: 'Touch-first register for mixed service + product sales.', category: 'operations', priceCents: 3990, dependencies: ['inventory'], icon: Calculator }),
  stub({ id: 'shop', name: 'Online Shop & Orders', description: 'Catalog, service menu and the full order lifecycle.', category: 'operations', priceCents: 3990, dependencies: ['inventory'], icon: ShoppingCart, clientFacing: true }),
  stub({ id: 'invoicing', name: 'Invoicing & Receipts', description: 'Invoices, receipts and recorded payments.', category: 'operations', priceCents: 1990, dependencies: [], icon: Receipt }),
  stub({ id: 'payments', name: 'Payments & Billing', description: 'Gateway config, charges, refunds and payouts.', category: 'operations', priceCents: 4990, dependencies: ['invoicing'], icon: CreditCard }),
  stub({ id: 'wallet', name: 'Customer Wallet & Credit', description: 'Balances, store credit and refund-to-credit.', category: 'customer', priceCents: 2490, dependencies: [], icon: Wallet, clientFacing: true }),
  stub({ id: 'subscriptions', name: 'Subscriptions & Auto-Ship', description: 'Recurring product boxes and service plans.', category: 'customer', priceCents: 2990, dependencies: ['payments'], icon: Repeat, clientFacing: true }),
  stub({ id: 'memberships', name: 'Memberships & Plans', description: 'Tiers, prepaid packages and member pricing.', category: 'customer', priceCents: 2490, dependencies: ['payments'], icon: Ticket, clientFacing: true }),
  stub({ id: 'promotions', name: 'Promotions & Deals', description: 'Flash deals, bundles and promo codes.', category: 'customer', priceCents: 1990, dependencies: [], icon: Percent, clientFacing: true }),
  stub({ id: 'loyalty', name: 'Loyalty & Marketing', description: 'Points, referrals and automated campaigns.', category: 'customer', priceCents: 2990, dependencies: ['clients'], icon: Award, clientFacing: true }),

  // stock & logistics
  stub({ id: 'inventory', name: 'Inventory & Stock', description: 'Products, stock levels, suppliers and purchase orders.', category: 'operations', priceCents: 2990, dependencies: [], icon: Package }),
  stub({ id: 'deliveries', name: 'Deliveries & Logistics', description: 'Delivery board, zones and driver assignment.', category: 'operations', priceCents: 2990, dependencies: ['shop'], icon: Truck }),
  stub({ id: 'transport', name: 'Pet Transport / Taxi', description: 'Pickup/drop-off jobs, routes and fares.', category: 'specialty', priceCents: 2990, dependencies: ['clients'], icon: Car, clientFacing: true }),

  // people
  stub({ id: 'workforce', name: 'Workforce & Time Tracking', description: 'Rota, clock in/out, leave and payroll.', category: 'operations', priceCents: 3990, dependencies: [], icon: Clock }),

  // service lines
  stub({ id: 'grooming', name: 'Grooming', description: 'Breed-based groom menu, groomer assignment and photos.', category: 'specialty', priceCents: 2490, dependencies: ['clients', 'appointments'], icon: Scissors }),
  stub({ id: 'boarding', name: 'Boarding & Daycare', description: 'Occupancy, check-in/out and care schedules.', category: 'specialty', priceCents: 2990, dependencies: ['clients'], icon: BedDouble, clientFacing: true }),
  stub({ id: 'veterinary', name: 'Veterinary / Health Records', description: 'SOAP notes, prescriptions, labs and vaccinations.', category: 'specialty', priceCents: 3990, dependencies: ['clients'], icon: Stethoscope }),
  stub({ id: 'training', name: 'Training', description: 'Session plans, progress notes and certificates.', category: 'specialty', priceCents: 1990, dependencies: ['clients'], icon: Dumbbell }),
  stub({ id: 'walking', name: 'Dog Walking / Field Services', description: 'Scheduled walks with live GPS and check-in photos.', category: 'specialty', priceCents: 2490, dependencies: ['clients', 'appointments'], icon: Footprints, clientFacing: true }),
  stub({ id: 'breeding', name: 'Breeding & Litters', description: 'Litters, reservations, waitlist and health tests.', category: 'specialty', priceCents: 2490, dependencies: ['clients'], icon: Dog, clientFacing: true }),

  // rescue & nonprofit
  stub({ id: 'rescue', name: 'Dog Rescue & Adoption', description: 'Intake, listings, fostering and applications.', category: 'specialty', priceCents: 2990, dependencies: [], icon: HeartHandshake, clientFacing: true }),
  stub({ id: 'donations', name: 'Donations & Fundraising', description: 'Campaigns, sponsorships and donor CRM.', category: 'specialty', priceCents: 2490, dependencies: ['payments'], icon: Heart, clientFacing: true }),
  stub({ id: 'events', name: 'Events & Classes Booking', description: 'Workshops, meetups and group classes with tickets.', category: 'customer', priceCents: 1990, dependencies: [], icon: CalendarDays, clientFacing: true }),
  stub({ id: 'lostfound', name: 'Lost & Found / Microchip', description: 'Lost/found reports, chip lookup and community alerts.', category: 'specialty', priceCents: 990, dependencies: [], icon: Search, clientFacing: true }),

  // governance & insight
  stub({ id: 'documents', name: 'Documents & Compliance', description: 'Waivers, e-signatures and incident reports.', category: 'operations', priceCents: 2490, dependencies: ['clients'], icon: FileText }),
  stub({ id: 'reviews', name: 'Reviews, Ratings & Tips', description: 'Post-visit surveys, review replies and staff tips.', category: 'customer', priceCents: 1490, dependencies: ['clients'], icon: Star, clientFacing: true }),
  stub({ id: 'support', name: 'Support & Disputes', description: 'Customer tickets and order disputes.', category: 'operations', priceCents: 1990, dependencies: ['shop'], icon: LifeBuoy, clientFacing: true }),
  stub({ id: 'facilities', name: 'Facilities & Maintenance', description: 'Cleaning schedules and equipment maintenance logs.', category: 'operations', priceCents: 1490, dependencies: [], icon: Wrench }),
  stub({ id: 'insurance', name: 'Pet Insurance & Wellness', description: 'Policies, wellness plans and claim assistance.', category: 'specialty', priceCents: 1990, dependencies: ['clients'], icon: Shield }),
  stub({ id: 'analytics', name: 'Analytics & Reports', description: 'Dashboards, custom reports and expense tracking.', category: 'operations', priceCents: 3990, dependencies: [], icon: BarChart3 }),
  stub({ id: 'branches', name: 'Multi-Location / Branches', description: 'Per-branch staff, pricing, stock and figures.', category: 'operations', priceCents: 4990, dependencies: [], icon: Building2 }),
];
