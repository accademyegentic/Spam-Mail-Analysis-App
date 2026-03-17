export interface EmailRecord {
  id: string;
  date: string; // ISO String YYYY-MM-DD
  subject: string;
  sender: string;
  recipient: string; // The account that received this email
  folder: string; // Changed from 'Inbox' | 'Spam' to string to support diverse folder names (e.g. Posteingang)
}

export interface Account {
  id: string;
  email: string;
  password: string;
  provider: string;
  client?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface AnalysisSummary {
  totalCount: number;
  dailyAverage: number;
  busiestDay: string;
  aiInsights: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  ANALYZING = 'ANALYZING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

// Helper to check if email is considered "Target" (Promo or Spam)
export const isPromoOrSpam = (folder: string) => {
  const f = folder.toLowerCase();
  // EXPLICIT EXCLUSION: "Unbekannt" (Unknown) and "Allgemein" (General) are often Inbox-adjacent in Germany, not Spam.
  if (f.includes('allgemein') || f.includes('unbekannt') || f.includes('posteingang')) return false;

  return f.includes('spam') || f.includes('junk') || f.includes('verdacht') || f.includes('pourriel') || f.includes('quarant') ||
         f.includes('promotion') || f.includes('werbung') || f.includes('offer') || f.includes('newsletter') || f.includes('update') ||
         f.includes('unerwünscht') || f.includes('abgelehnt');
};
