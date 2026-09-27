export type MobileTarget = "android" | "ios";
export type DeploymentStatus = "queued" | "building" | "ready" | "failed" | "stopped" | "expired";

export interface MobileDeployment {
  id: string;
  appId: string;
  target: MobileTarget;
  revision: number;
  status: DeploymentStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  error?: string;
  tunnelUrl?: string;
  size?: number;
  sha256?: string;
}

export interface MobileDeploymentList {
  deployments: MobileDeployment[];
  availability: Record<MobileTarget, { available: boolean; reason: string }>;
}

export const DEPLOYMENT_LABELS: Record<DeploymentStatus, string> = {
  queued: "Waiting for a worker",
  building: "Preparing",
  ready: "Ready",
  failed: "Failed",
  stopped: "Stopped",
  expired: "Expired",
};
