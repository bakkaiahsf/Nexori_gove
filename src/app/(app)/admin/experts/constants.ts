export type ExpertData = {
  id: string;
  email: string;
  name: string | null;
  domains: string[];
  jurisdictions: string[];
  activeApprovals: number;
  avgResolutionHours: number | null;
  lastActiveAt: Date | null;
  createdAt: Date;
};
