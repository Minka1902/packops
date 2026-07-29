import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import ProtectedRoute from '@/shared/layout/ProtectedRoute';
import RequireMode from '@/shared/layout/RequireMode';
import AppShell from '@/shared/layout/AppShell';
import BusinessAppShell from '@/shared/layout/BusinessAppShell';
import { ALL_MANIFESTS } from '@/modules/registry';
import { ModuleGate } from '@/modules/react';

// Every module's routes, each mounted under a ModuleGate that enforces unlock +
// read at runtime (locked/denied modules render an in-place notice). Registered
// statically for all modules so navigation doesn't churn as modules unlock.
function moduleRouteGroups(): RouteObject[] {
  return ALL_MANIFESTS
    .filter((m) => m.routes?.length)
    .map((m) => ({
      element: <ModuleGate moduleId={m.id} />,
      children: (m.routes ?? []).map((r) => ({ path: `/business/${r.path}`, lazy: r.lazy })),
    }));
}

// Auth + public pages — kept eager (needed before any JS chunk arrives)
import LoginPage    from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';
import PublicQRPage from '@/features/qr/pages/PublicQRPage';

// All other pages lazy-loaded: downloaded only when first visited
const ActiveWalkPage            = lazy(() => import('@/features/walk/pages/ActiveWalkPage'));
const WalkSummaryPage           = lazy(() => import('@/features/walk/pages/WalkSummaryPage'));
const ActiveTrainingPage        = lazy(() => import('@/features/training/pages/ActiveTrainingPage'));
const DashboardPage             = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const CreateDogPage             = lazy(() => import('@/features/dog/pages/CreateDogPage'));
const EditDogPage               = lazy(() => import('@/features/dog/pages/EditDogPage'));
const JoinDogPage               = lazy(() => import('@/features/dog/pages/JoinDogPage'));
const RoutinePage               = lazy(() => import('@/features/routine/pages/RoutinePage'));
const TrainingPage              = lazy(() => import('@/features/training/pages/TrainingPage'));
const NewTrainingSessionPage    = lazy(() => import('@/features/training/pages/NewTrainingSessionPage'));
const TrainingSessionDetailPage = lazy(() => import('@/features/training/pages/TrainingSessionDetailPage'));
const MedicalPage               = lazy(() => import('@/features/medical/pages/MedicalPage'));
const HumansPage                = lazy(() => import('@/features/team/pages/HumansPage'));
const DiscoverPage              = lazy(() => import('@/features/discover/pages/DiscoverPage'));
const BusinessBookingPage       = lazy(() => import('@/features/discover/pages/BusinessBookingPage'));
const BusinessGroomingPage      = lazy(() => import('@/features/discover/pages/BusinessGroomingPage'));
const BusinessWaiversPage       = lazy(() => import('@/features/discover/pages/BusinessWaiversPage'));
const BusinessOrderPage         = lazy(() => import('@/features/discover/pages/BusinessOrderPage'));
const BusinessStayRequestPage   = lazy(() => import('@/features/discover/pages/BusinessStayRequestPage'));
const DevicesPage               = lazy(() => import('@/features/devices/pages/DevicesPage'));
const QRPage                    = lazy(() => import('@/features/qr/pages/QRPage'));
const SettingsPage              = lazy(() => import('@/features/settings/pages/SettingsPage'));

// Business CRM pages
const BusinessRegisterPage  = lazy(() => import('@/features/business/pages/BusinessRegisterPage'));
const OwnerDashboardPage    = lazy(() => import('@/features/business/pages/OwnerDashboardPage'));
const ModuleStorePage       = lazy(() => import('@/features/business/pages/ModuleStorePage'));
const CustomersPage         = lazy(() => import('@/features/business/pages/CustomersPage'));
const AppointmentsPage      = lazy(() => import('@/features/business/pages/AppointmentsPage'));
const InvoicesPage          = lazy(() => import('@/features/business/pages/InvoicesPage'));
const InventoryPage         = lazy(() => import('@/features/business/pages/InventoryPage'));
const OrdersPage            = lazy(() => import('@/features/business/pages/OrdersPage'));
const BoardingPage          = lazy(() => import('@/features/business/pages/BoardingPage'));
const ServicesPage          = lazy(() => import('@/features/business/pages/ServicesPage'));
const GroomingPage          = lazy(() => import('@/features/business/pages/GroomingPage'));
const WaiversPage           = lazy(() => import('@/features/business/pages/WaiversPage'));
const PurchasingPage        = lazy(() => import('@/features/business/pages/PurchasingPage'));
const ShiftsPage            = lazy(() => import('@/features/business/pages/ShiftsPage'));
const PayrollPage           = lazy(() => import('@/features/business/pages/PayrollPage'));
const ExpensesPage          = lazy(() => import('@/features/business/pages/ExpensesPage'));
const ReportsPage           = lazy(() => import('@/features/business/pages/ReportsPage'));
const MessagesPage          = lazy(() => import('@/features/business/pages/MessagesPage'));
const ReportCardsPage       = lazy(() => import('@/features/business/pages/ReportCardsPage'));
const PackagesPage          = lazy(() => import('@/features/business/pages/PackagesPage'));
const PatientsPage          = lazy(() => import('@/features/business/pages/PatientsPage'));
const PatientChartPage      = lazy(() => import('@/features/business/pages/PatientChartPage'));
const ClassesPage           = lazy(() => import('@/features/business/pages/ClassesPage'));
const BusinessClassesPage   = lazy(() => import('@/features/discover/pages/BusinessClassesPage'));
const AdoptionsPage         = lazy(() => import('@/features/business/pages/AdoptionsPage'));
const BusinessAdoptPage     = lazy(() => import('@/features/discover/pages/BusinessAdoptPage'));
const BreedingPage          = lazy(() => import('@/features/business/pages/BreedingPage'));
const BusinessLittersPage   = lazy(() => import('@/features/discover/pages/BusinessLittersPage'));
const MyMessagesPage        = lazy(() => import('@/features/messages/pages/MyMessagesPage'));
const ShipmentsPage         = lazy(() => import('@/features/business/pages/ShipmentsPage'));
const SecurityPage          = lazy(() => import('@/features/business/pages/SecurityPage'));
const BusinessSettingsPage  = lazy(() => import('@/features/business/pages/BusinessSettingsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/login',             element: <LoginPage /> },
  { path: '/register',          element: <RegisterPage /> },
  { path: '/dog/:dogId/public', element: <PublicQRPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      // Full-screen walk/training UI — no AppShell (personal mode)
      {
        element: <RequireMode mode="personal" />,
        children: [
          { path: '/walk/active',     element: <Suspense fallback={null}><ActiveWalkPage /></Suspense> },
          { path: '/walk/summary',    element: <Suspense fallback={null}><WalkSummaryPage /></Suspense> },
          { path: '/training/active', element: <Suspense fallback={null}><ActiveTrainingPage /></Suspense> },
        ],
      },
      // Personal (dog-owner) app
      {
        element: <RequireMode mode="personal" />,
        children: [
          {
            element: (
              <Suspense fallback={<PageLoader />}>
                <AppShell />
              </Suspense>
            ),
            children: [
              { path: '/',                     element: <DashboardPage /> },
              { path: '/dogs/new',             element: <CreateDogPage /> },
              { path: '/dogs/:dogId/edit',     element: <EditDogPage /> },
              { path: '/dogs/join',            element: <JoinDogPage /> },
              { path: '/routine',              element: <RoutinePage /> },
              { path: '/training',             element: <TrainingPage /> },
              { path: '/training/new',         element: <NewTrainingSessionPage /> },
              { path: '/training/:sessionId',  element: <TrainingSessionDetailPage /> },
              { path: '/medical',              element: <MedicalPage /> },
              { path: '/humans',               element: <HumansPage /> },
              { path: '/discover',             element: <DiscoverPage /> },
              { path: '/discover/:bid',        element: <BusinessBookingPage /> },
              { path: '/discover/:bid/order',  element: <BusinessOrderPage /> },
              { path: '/discover/:bid/boarding', element: <BusinessStayRequestPage /> },
              { path: '/discover/:bid/grooming', element: <BusinessGroomingPage /> },
              { path: '/discover/:bid/waivers', element: <BusinessWaiversPage /> },
              { path: '/discover/:bid/classes', element: <BusinessClassesPage /> },
              { path: '/discover/:bid/adopt',  element: <BusinessAdoptPage /> },
              { path: '/discover/:bid/litters', element: <BusinessLittersPage /> },
              { path: '/messages',             element: <MyMessagesPage /> },
              { path: '/devices',              element: <DevicesPage /> },
              { path: '/qr',                   element: <QRPage /> },
              { path: '/settings',             element: <SettingsPage /> },
            ],
          },
        ],
      },
      // Business CRM app
      {
        element: <RequireMode mode="business" />,
        children: [
          {
            element: (
              <Suspense fallback={<PageLoader />}>
                <BusinessAppShell />
              </Suspense>
            ),
            children: [
              { path: '/business',              element: <OwnerDashboardPage /> },
              { path: '/business/store',        element: <ModuleStorePage /> },
              { path: '/business/new',          element: <BusinessRegisterPage /> },
              { path: '/business/customers',    element: <CustomersPage /> },
              { path: '/business/appointments', element: <AppointmentsPage /> },
              { path: '/business/invoices',     element: <InvoicesPage /> },
              { path: '/business/inventory',    element: <InventoryPage /> },
              { path: '/business/orders',      element: <OrdersPage /> },
              { path: '/business/boarding',    element: <BoardingPage /> },
              { path: '/business/services',    element: <ServicesPage /> },
              { path: '/business/grooming',    element: <GroomingPage /> },
              { path: '/business/waivers',     element: <WaiversPage /> },
              { path: '/business/purchasing',  element: <PurchasingPage /> },
              { path: '/business/shifts',      element: <ShiftsPage /> },
              { path: '/business/payroll',     element: <PayrollPage /> },
              { path: '/business/expenses',    element: <ExpensesPage /> },
              { path: '/business/reports',     element: <ReportsPage /> },
              { path: '/business/messages',    element: <MessagesPage /> },
              { path: '/business/report-cards', element: <ReportCardsPage /> },
              { path: '/business/packages',    element: <PackagesPage /> },
              { path: '/business/patients',    element: <PatientsPage /> },
              { path: '/business/patients/:petId', element: <PatientChartPage /> },
              { path: '/business/classes',     element: <ClassesPage /> },
              { path: '/business/adoptions',   element: <AdoptionsPage /> },
              { path: '/business/breeding',    element: <BreedingPage /> },
              { path: '/business/shipments',    element: <ShipmentsPage /> },
              { path: '/business/security',     element: <SecurityPage /> },
              { path: '/business/settings',     element: <BusinessSettingsPage /> },
              // Module-provided routes (staff, roles, …) gated by ModuleGate.
              ...moduleRouteGroups(),
            ],
          },
        ],
      },
    ],
  },
]);
