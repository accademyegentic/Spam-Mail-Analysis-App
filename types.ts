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
export const isPromoOrSpam = (email: EmailRecord) => {
  const folder = email.folder.toLowerCase();
  const sender = email.sender.toLowerCase();
  const recipient = email.recipient.toLowerCase();

  // Rule for web.de domains: sender must have 'web.de' to be in inbox
  if (recipient.endsWith('@web.de')) {
    return !sender.includes('web.de');
  }

  // Rule for gmx.net domains: sender must have 'gmx.net' to be in inbox
  if (recipient.endsWith('@gmx.net')) {
    return !sender.includes('gmx.net');
  }

  // EXPLICIT EXCLUSION: "Unbekannt" (Unknown) and "Allgemein" (General) are often Inbox-adjacent in Germany, not Spam.
  if (folder.includes('allgemein') || folder.includes('unbekannt') || folder.includes('posteingang')) return false;

  return folder.includes('spam') || folder.includes('junk') || folder.includes('verdacht') || folder.includes('pourriel') || folder.includes('quarant') ||
         folder.includes('promotion') || folder.includes('werbung') || folder.includes('offer') || folder.includes('newsletter') || folder.includes('update') ||
         folder.includes('unerwünscht') || folder.includes('abgelehnt');
};
