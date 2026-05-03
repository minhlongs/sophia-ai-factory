'use client';

/**
 * License Management Admin Page
 * /admin/licenses - Quản lý license keys cho ROIaaS
 */

import { useState } from 'react';
import type { LicenseSummary } from '@/lib/raas-schema';
import { LicenseGenerator } from '@/components/admin/licenses/license-generator';
import { LicenseList } from '@/components/admin/licenses/license-list';
import { AuditLogTable } from '@/components/admin/licenses/audit-log-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/seed/components/ui/tabs';
import { logger } from '@/seed/utils/logger-utility';

export default function LicensesAdminPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [selectedLicenseId, setSelectedLicenseId] = useState<string | undefined>();

  const handleLicenseCreated = (data: LicenseSummary) => {
    // Optionally switch to list view or show detail
    logger.info('License created', { data });
  };

  const handleRevoke = (id: string) => {
    logger.info('License revoked', { licenseId: id });
  };

  const handleView = (id: string) => {
    setSelectedLicenseId(id);
    setActiveTab('audit');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">License Management</h1>
        <p className="text-muted-foreground">
          Create, view, and revoke RaaS license keys
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted border border-border">
          <TabsTrigger
            value="list"
            className="data-[state=active]:bg-[var(--neon-cyan)]/10 data-[state=active]:text-[var(--neon-cyan)]"
          >
            All Licenses
          </TabsTrigger>
          <TabsTrigger
            value="create"
            className="data-[state=active]:bg-[var(--neon-cyan)]/10 data-[state=active]:text-[var(--neon-cyan)]"
          >
            Generate Key
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-[var(--neon-cyan)]/10 data-[state=active]:text-[var(--neon-cyan)]"
          >
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <LicenseList
            onRevoke={handleRevoke}
            onView={handleView}
          />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <LicenseGenerator onLicenseCreated={handleLicenseCreated} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogTable licenseId={selectedLicenseId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
