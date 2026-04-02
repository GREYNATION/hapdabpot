export type DashboardStage = "architect" | "stitch" | "marketing" | "developer" | "deploy";
export type DashboardStatus = "pending" | "running" | "complete" | "failed";

export interface DashboardPatch {
  stage: DashboardStage;
  status: DashboardStatus;
  message?: string;
  overallStatus?: "complete" | "failed";
}

export interface StageState {
  status: DashboardStatus;
  message?: string;
}

export interface FactoryDashboardState {
  id: string;
  telegramMessageId?: number;
  chatId?: number | string;
  status: "planning" | "building" | "deploying" | "complete" | "failed";

  stages: {
    architect: StageState;
    stitch: StageState;
    marketing: StageState;
    developer: StageState;
    deploy: StageState;
  };

  timestamps: {
    startedAt: number;
    updatedAt: number;
    finishedAt?: number;
  };

  logs: string[];
}
