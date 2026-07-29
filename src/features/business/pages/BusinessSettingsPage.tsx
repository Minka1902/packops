import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { Switch } from '@/shared/ui/switch';
import { useBusiness, useBusinessActions } from '@/features/business/hooks/useBusiness';
import { usePermissions } from '@/shared/hooks/usePermissions';
import BusinessProfileForm, { type BusinessProfileFormData } from '@/features/business/components/BusinessProfileForm';
import AvailabilityEditor from '@/features/business/components/AvailabilityEditor';
import CommerceSettingsCard from '@/features/business/components/CommerceSettingsCard';
import BoardingSettingsCard from '@/features/business/components/BoardingSettingsCard';
import GroomingSettingsCard from '@/features/business/components/GroomingSettingsCard';
import WaiversSettingsCard from '@/features/business/components/WaiversSettingsCard';
import ModuleSetupStatusCard from '@/features/business/components/ModuleSetupStatusCard';
import { refreshBoardingAvailability, refreshGroomMenu, resyncCatalog, resyncWaivers } from '@/features/business/hooks/useBusiness';
import {
  ALL_MODULES, MODULE_CATALOG, isModuleEnabled,
  type BoardingSettings, type BusinessModule, type CommerceSettings, type GroomingSettings,
  type ModuleGroup, type WaiversSettings, type WeeklyAvailability,
} from '@/shared/types';

const MODULE_GROUPS: ModuleGroup[] = ['Operations', 'Customer', 'Specialty'];

export default function BusinessSettingsPage() {
  const { activeBusiness } = useBusiness();
  const { isOwner, can } = usePermissions();
  const navigate = useNavigate();
  const bid = activeBusiness?.id ?? '';
  const { updateBusiness, deleteBusiness } = useBusinessActions(bid);
  const [deleting, setDeleting] = useState(false);

  if (!activeBusiness) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">No business selected.</div>;
  }
  if (!can('manage_business') && !isOwner) {
    return <div className="mx-auto max-w-2xl py-14 text-center text-sm text-muted-foreground">You don't have access to business settings.</div>;
  }

  const toggleModule = async (module: BusinessModule, enabled: boolean) => {
    // Start from the current effective set (undefined ⇒ all enabled).
    const current = activeBusiness.modules ?? ALL_MODULES;
    const next = enabled
      ? ALL_MODULES.filter(m => current.includes(m) || m === module)
      : current.filter(m => m !== module);
    await updateBusiness({ modules: next });
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${activeBusiness.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteBusiness();
      navigate('/business');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-4">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Business profile</CardTitle></CardHeader>
        <CardContent>
          <BusinessProfileForm
            initial={activeBusiness}
            onSubmit={async (data: BusinessProfileFormData) => { await updateBusiness(data); }}
          />
        </CardContent>
      </Card>

      {isModuleEnabled(activeBusiness, 'orders') && (
        <CommerceSettingsCard
          business={activeBusiness}
          onSave={async (commerce: CommerceSettings) => {
            await updateBusiness({ commerce });
            // Publish or retract the public product catalog to match the toggle.
            await resyncCatalog(bid, commerce.ordersOpen).catch(() => undefined);
          }}
        />
      )}

      {isModuleEnabled(activeBusiness, 'boarding') && (
        <BoardingSettingsCard
          business={activeBusiness}
          onSave={async (boarding: BoardingSettings) => {
            await updateBusiness({ boarding });
            // Re-derive the public full-dates calendar under the new capacity.
            await refreshBoardingAvailability(bid).catch(() => undefined);
          }}
        />
      )}

      {isModuleEnabled(activeBusiness, 'grooming') && (
        <GroomingSettingsCard
          business={activeBusiness}
          onSave={async (grooming: GroomingSettings) => {
            await updateBusiness({ grooming });
            // Republish the public groom menu so the booking page is in sync.
            await refreshGroomMenu(bid).catch(() => undefined);
          }}
        />
      )}

      {isModuleEnabled(activeBusiness, 'waivers') && (
        <WaiversSettingsCard
          business={activeBusiness}
          onSave={async (waivers: WaiversSettings) => {
            await updateBusiness({ waivers });
            // Publish or retract the public waiver templates to match the toggle.
            await resyncWaivers(bid, waivers.published).catch(() => undefined);
          }}
        />
      )}

      {isModuleEnabled(activeBusiness, 'appointments') && (
        <Card>
          <CardHeader>
            <CardTitle>Booking hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set your weekly opening hours and slot length. Customers booking online can only
              pick free slots within these hours.
            </p>
            <AvailabilityEditor
              initialAvailability={activeBusiness.availability}
              initialSlotMinutes={activeBusiness.slotMinutes}
              onSave={async (availability: WeeklyAvailability, slotMinutes: number) => {
                await updateBusiness({ availability, slotMinutes });
              }}
            />
          </CardContent>
        </Card>
      )}

      <ModuleSetupStatusCard business={activeBusiness} />

      <Card>
        <CardHeader>
          <CardTitle>Pages &amp; modules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Turn off the features your business doesn't use. Disabled pages disappear from the
            sidebar — for example a trainer who only sells their time can hide Inventory and Shipments.
          </p>
          {MODULE_GROUPS.map(group => (
            <div key={group} className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="divide-y rounded-lg border">
                {MODULE_CATALOG.filter(m => m.group === group).map(({ module, label, description }) => (
                  <div key={module} className="flex items-center justify-between px-4 py-3">
                    <div className="pr-4">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={isModuleEnabled(activeBusiness, module)}
                      onCheckedChange={(v) => toggleModule(module, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Deleting this business removes all customers, appointments, invoices, inventory and staff records. This cannot be undone.
            </p>
            <Separator />
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete business'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
