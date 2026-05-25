import prisma from "@/lib/db";
import { RegulatoryFramework } from "@prisma/client";
import FrameworkConfigClient from "./FrameworkConfigClient";

export const dynamic = "force-dynamic";

export interface FrameworkInfo {
  id: RegulatoryFramework;
  label: string;
  full: string;
  region: string;
  sectors: string[];
  mandatoryFor: string[];
  description: string;
  agileControls: string[];
  controlCount: number; // how many controls we have mapped
}

const FRAMEWORK_LIBRARY: FrameworkInfo[] = [
  {
    id: "DORA",
    label: "DORA",
    full: "Digital Operational Resilience Act",
    region: "EU",
    sectors: ["Banking", "Insurance", "Investment Firms", "Fintech", "Payment Services"],
    mandatoryFor: ["EU Financial Services", "EU Insurance", "EU Fintech"],
    description:
      "Mandatory for EU financial sector. Covers ICT risk management, incident reporting, third-party oversight, and operational resilience testing.",
    agileControls: [
      "Deployment gate checks",
      "ICT change management gates",
      "Third-party onboarding review",
      "Incident classification triggers",
    ],
    controlCount: 0,
  },
  {
    id: "EU_AI_ACT",
    label: "EU AI Act",
    full: "EU Artificial Intelligence Act",
    region: "EU",
    sectors: [
      "All sectors with AI systems",
      "Financial Services",
      "Healthcare",
      "Critical Infrastructure",
    ],
    mandatoryFor: ["Any organisation deploying AI in the EU market"],
    description:
      "Risk-based framework for AI systems deployed in the EU. Prohibits high-risk uses. Mandates transparency, human oversight, and audit trails for AI decisions.",
    agileControls: [
      "AI deployment governance gates",
      "Model risk assessment",
      "AI usage event logging",
      "Human-in-the-loop enforcement",
    ],
    controlCount: 0,
  },
  {
    id: "SOC2",
    label: "SOC 2",
    full: "SOC 2 Type II",
    region: "US / Global",
    sectors: ["SaaS", "Cloud Services", "Technology", "Data Processing"],
    mandatoryFor: ["US SaaS companies", "Cloud service providers serving US customers"],
    description:
      "Trust Services Criteria covering Security, Availability, Processing Integrity, Confidentiality, and Privacy. Common requirement for B2B SaaS.",
    agileControls: [
      "Change management approval gates",
      "Access review checkpoints",
      "Incident response gates",
      "Vendor assessment gates",
    ],
    controlCount: 0,
  },
  {
    id: "ISO_27001",
    label: "ISO 27001",
    full: "ISO/IEC 27001:2022",
    region: "Global",
    sectors: ["All industries", "Financial Services", "Healthcare", "Government", "Technology"],
    mandatoryFor: ["Enterprises requiring international information security certification"],
    description:
      "International standard for Information Security Management Systems (ISMS). Covers risk assessment, controls, and continual improvement across 93 controls.",
    agileControls: [
      "Security review gates",
      "Risk assessment checkpoints",
      "Change management gates",
      "Supplier security gates",
    ],
    controlCount: 0,
  },
  {
    id: "PCI_DSS",
    label: "PCI-DSS",
    full: "PCI Data Security Standard v4.0",
    region: "Global",
    sectors: ["Payment Processing", "Retail", "Banking", "Fintech", "E-commerce"],
    mandatoryFor: ["Any organisation storing, processing, or transmitting cardholder data"],
    description:
      "Security standard for organisations handling credit card data. 12 high-level requirements covering network security, access controls, monitoring, and testing.",
    agileControls: [
      "Code review gates for payment flows",
      "Penetration test sign-off",
      "Network change approval",
      "Encryption compliance gates",
    ],
    controlCount: 0,
  },
  {
    id: "GDPR",
    label: "GDPR",
    full: "General Data Protection Regulation",
    region: "EU / UK",
    sectors: ["All industries processing EU/UK personal data"],
    mandatoryFor: ["Any organisation processing personal data of EU/UK residents"],
    description:
      "Data protection regulation requiring lawful processing, data minimisation, rights of individuals, breach notification within 72 hours, and DPO appointment where required.",
    agileControls: [
      "Data processing assessment gates",
      "DPO review gates",
      "Privacy-by-design checkpoints",
      "Breach response triggers",
    ],
    controlCount: 0,
  },
];

export default async function FrameworksPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const project = searchParams.projectId
    ? await prisma.project.findUnique({ where: { id: searchParams.projectId }, select: { id: true, name: true, key: true, domain: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, key: true, domain: true } });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">No active project found.</p>
      </div>
    );
  }

  // Get control counts per framework
  const controlCounts = await prisma.regulatoryMapping.groupBy({
    by: ["framework"],
    where: { projectId: project.id },
    _count: { id: true },
  });

  // Get existing trigger rules per source
  const triggerRules = await prisma.governanceTriggerRule.findMany({
    where: { projectId: project.id, enabled: true },
    select: { id: true, source: true, name: true },
  });

  const frameworks = FRAMEWORK_LIBRARY.map((f) => ({
    ...f,
    controlCount: controlCounts.find((c) => c.framework === f.id)?._count.id ?? 0,
    active: controlCounts.some((c) => c.framework === f.id),
  }));

  const connectors = await prisma.sourceConnector.findMany({
    select: { id: true, type: true, name: true, enabled: true },
  });

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Compliance Frameworks
          </h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {project.name} · Select what governance applies to this project
          </span>
        </div>
        <span className="font-mono-technical text-[10px] text-on-surface-variant">
          {controlCounts.length} ACTIVE · {FRAMEWORK_LIBRARY.length - controlCounts.length}{" "}
          AVAILABLE
        </span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FrameworkConfigClient
          projectId={project.id}
          projectName={project.name}
          frameworks={frameworks}
          connectors={connectors}
          triggerRules={triggerRules}
        />
      </div>
    </>
  );
}
