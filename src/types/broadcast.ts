export interface Broadcast {
  id: string;
  createdAt: string | null;
  createdBy: number | null;
  sentCount: number;
  failedCount: number;
  reason: string;
  text: string;
}