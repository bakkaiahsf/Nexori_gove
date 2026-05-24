import prisma from "@/lib/db";
import {
  getAIControlSetting,
  getPendingApprovals,
  getRegulatoryData,
  DEMO_PROJECT_KEY,
} from "@/lib/governance";
import AIModeToggle from "@/components/governance/AIModeToggle";
import ApproveButton from "@/components/governance/ApproveButton";
import RejectButton from "@/components/governance/RejectButton";
import EmergencyButton from "@/components/governance/EmergencyButton";
import { AIControlMode } from "@prisma/client";

export const dynamic = "force-dynamic";

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    "change-delivery": "Change",
    "ai-deployment": "AI Deploy",
    "third-party-onboarding": "3rd Party",
    incident: "Incident",
  };
  return map[phase] ?? phase;
}

const CRITICALITY_CLASS: Record<string, string> = {
  critical: "bg-critical/10 text-critical border border-critical",
  important: "bg-tertiary/20 text-tertiary border border-tertiary",
  standard: "bg-primary/10 text-primary border border-primary",
};

const SERVICE_LABEL: Record<string, string> = {
  "ai-model": "AI MODEL",
  cloud: "CLOUD",
  saas: "SAAS",
  data: "DATA",
  security: "SECURITY",
  identity: "IDENTITY",
};

export default async function AIControl() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No project — run: <code className="text-primary">npx prisma db seed</code>
        </p>
      </div>
    );
  }

  const [aiSetting, approvals, { thirdParties }] = await Promise.all([
    getAIControlSetting(project.id),
    getPendingApprovals(project.id),
    getRegulatoryData(project.id),
  ]);

  const currentMode = aiSetting?.mode ?? AIControlMode.AI_ASSIST;
  const isEmergencyLocked = currentMode === AIControlMode.EMERGENCY_LOCK;

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <h1 className="font-headline-md text-headline-md text-on-surface">AI Control Center</h1>
        <div className="flex items-center gap-md">
          {isEmergencyLocked ? (
            <span className="px-2 py-1 bg-critical text-on-error font-mono-technical text-[10px] animate-pulse">
              EMERGENCY LOCK — AI DISABLED
            </span>
          ) : (
            <span className="px-2 py-1 bg-primary/10 border border-primary text-primary font-mono-technical text-[10px]">
              MODE: {currentMode.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1440px] mx-auto grid grid-cols-12 gap-lg">
          {/* Emergency Protocol */}
          <div className="col-span-12 md:col-span-4 bg-surface-elevated border border-critical p-xl">
            <h3 className="font-label-caps text-label-caps text-critical tracking-widest mb-sm">
              EMERGENCY PROTOCOL
            </h3>
            <p className="font-mono-technical text-[11px] text-on-surface-variant mb-lg">
              Master AI Kill Switch
            </p>
            <p className="font-body-base text-body-base text-on-surface-variant mb-xl">
              Immediately locks all AI invocations. Governance workflows continue uninterrupted.
              Every engagement logged as a <span className="text-critical">GovernanceEvent</span>.
            </p>
            <EmergencyButton isLocked={isEmergencyLocked} />
            {aiSetting?.setAt && (
              <p className="mt-md font-mono-technical text-[10px] text-on-surface-variant">
                LAST CHANGED: {new Date(aiSetting.setAt).toLocaleString("en-GB")}
                {aiSetting.setBy && ` · ${aiSetting.setBy}`}
              </p>
            )}
          </div>

          {/* Governance Mode — live AIModeToggle */}
          <div className="col-span-12 md:col-span-4 bg-surface border border-border-muted p-xl">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-lg">
              GOVERNANCE MODE
            </h3>
            <AIModeToggle currentMode={currentMode} />
            {aiSetting?.reason && (
              <p className="mt-lg font-mono-technical text-[10px] text-on-surface-variant border-t border-border-muted pt-md">
                REASON: {aiSetting.reason}
              </p>
            )}
          </div>

          {/* Human-in-the-Loop — real pending approvals */}
          <div className="col-span-12 md:col-span-4 bg-surface border border-border-muted">
            <div className="p-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                HUMAN-IN-THE-LOOP
              </h3>
              <span
                className={`px-2 py-0.5 font-mono-technical text-[10px] ${
                  approvals.length > 0
                    ? "bg-tertiary/20 text-tertiary border border-tertiary"
                    : "bg-primary/10 text-primary border border-primary"
                }`}
              >
                {approvals.length} PENDING
              </span>
            </div>
            <div className="divide-y divide-border-muted">
              {approvals.length === 0 ? (
                <div className="p-lg">
                  <p className="font-mono-technical text-[11px] text-primary">
                    All approvals complete.
                  </p>
                </div>
              ) : (
                approvals.map((a) => (
                  <div
                    key={a.id}
                    className="p-lg hover:bg-surface-container-high transition-colors"
                  >
                    <div className="flex items-center justify-between mb-sm">
                      <span className="font-mono-technical text-[11px] text-on-surface-variant">
                        #{a.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="font-mono-technical text-[10px] text-tertiary">
                        {phaseLabel(a.gate.case.phase)}
                      </span>
                    </div>
                    <p className="font-body-bold text-body-bold text-on-surface mb-md truncate">
                      {a.gate.name}
                    </p>
                    <div className="flex gap-sm">
                      <ApproveButton approvalId={a.id} />
                      <RejectButton approvalId={a.id} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Third-Party Registry — real DORA data */}
          <div className="col-span-12 bg-surface border border-border-muted">
            <div className="p-xl border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                THIRD-PARTY REGISTER
              </h3>
              <div className="flex items-center gap-md">
                <span className="font-mono-technical text-[11px] text-on-surface-variant">
                  {thirdParties.filter((t) => t.criticality === "critical").length} Critical ·{" "}
                  {thirdParties.length} Total · DORA Art. 28
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-border-muted">
                  <tr>
                    {[
                      "VENDOR",
                      "SERVICE TYPE",
                      "CRITICALITY",
                      "REGION",
                      "NEXT REVIEW",
                      "STATUS",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-xl py-md font-label-caps text-label-caps text-on-surface-variant"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {thirdParties.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-xl py-md font-body-bold text-body-bold text-on-surface">
                        {t.vendorName}
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">
                        {SERVICE_LABEL[t.serviceType] ?? t.serviceType.toUpperCase()}
                      </td>
                      <td className="px-xl py-md">
                        <span
                          className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase ${
                            CRITICALITY_CLASS[t.criticality] ?? CRITICALITY_CLASS.standard
                          }`}
                        >
                          {t.criticality}
                        </span>
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">
                        {t.regionOfHosting ?? "—"}
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">
                        {t.nextReviewDue
                          ? new Date(t.nextReviewDue).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-xl py-md">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px]">
                          REGISTERED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Footer ── */}
      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span
              className={`w-2 h-2 rounded-full ${isEmergencyLocked ? "bg-critical animate-pulse" : "bg-primary animate-pulse"}`}
            />
            <span>
              {isEmergencyLocked ? "AI_GOVERNANCE: LOCKED" : "AI_GOVERNANCE: OPERATIONAL"}
            </span>
          </div>
          <span>MODE: {currentMode.replace(/_/g, " ")}</span>
          <span>POLICY_VERSION: v3.1.4-DORA</span>
        </div>
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
