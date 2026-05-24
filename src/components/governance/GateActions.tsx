"use client";

import { useState } from "react";
import ApproveButton from "./ApproveButton";
import RejectButton from "./RejectButton";
import WaiverRequestButton from "./WaiverRequestButton";

interface Gate {
  id: string;
  name: string;
  status: string;
  skipped: boolean;
  pendingApprovalId: string | null;
}

export default function GateActions({
  gate,
  caseId,
  projectId,
}: {
  gate: Gate;
  caseId: string;
  projectId: string;
}) {
  const [showWaiver, setShowWaiver] = useState(false);

  if (gate.skipped) return null;

  const canRequestWaiver =
    gate.status === "REJECTED" || gate.status === "OPEN" || gate.status === "PENDING";

  return (
    <div className="ml-6 mt-sm space-y-sm">
      {gate.pendingApprovalId && (
        <div className="flex gap-xs">
          <ApproveButton approvalId={gate.pendingApprovalId} />
          <RejectButton approvalId={gate.pendingApprovalId} />
        </div>
      )}

      {canRequestWaiver && !showWaiver && (
        <WaiverRequestButton
          caseId={caseId}
          gateId={gate.id}
          gateName={gate.name}
          projectId={projectId}
        />
      )}
    </div>
  );
}
