import { EmailRecord, Account, DateRange, isPromoOrSpam } from "../types";

// Fetch real emails from our backend API (IMAP over TLS)
export const fetchRealEmails = async (
  accounts: Account[],
  dateRange: DateRange
): Promise<EmailRecord[]> => {
  const response = await fetch("/api/fetch-emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accounts,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch from mail servers");
  }

  const data = await response.json();
  return data.emails;
};

// Mark emails as read on the IMAP server
export const markEmailsAsRead = async (
  accounts: Account[],
  toMark: Array<{ emailId: string; folder: string; recipient: string }>
): Promise<{ success: number; failed: number }> => {
  const response = await fetch("/api/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accounts, toMark }),
  });
  if (!response.ok) throw new Error("Failed to mark emails as read");
  return response.json();
};

// Local deterministic analysis summary
export const generateAnalysisSummary = async (
  emails: EmailRecord[],
  startDate: string,
  endDate: string
): Promise<string> => {
  const promoSpam = emails.filter((e) => isPromoOrSpam(e));

  if (promoSpam.length === 0) {
    return `No promotional or spam emails detected between ${startDate} and ${endDate}.`;
  }

  // 1. Which account is targeted the most?
  const accountCounts = new Map<string, number>();
  promoSpam.forEach((e) => {
    accountCounts.set(e.recipient, (accountCounts.get(e.recipient) || 0) + 1);
  });
  const mostTargeted = [...accountCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];

  // 2. Top recurring sender domains
  const domainCounts = new Map<string, number>();
  promoSpam.forEach((e) => {
    const domain = e.sender.includes("@")
      ? e.sender.split("@")[1].toLowerCase()
      : "unknown";
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  });
  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 3. Spam ratio
  const spamRatio = Math.round((promoSpam.length / emails.length) * 100);

  const parts: string[] = [];
  parts.push(
    `Between ${startDate} and ${endDate}, ${promoSpam.length} out of ${emails.length} emails (${spamRatio}%) were identified as promotional or spam.`
  );
  if (mostTargeted) {
    parts.push(
      `The most targeted account is ${mostTargeted[0]} with ${mostTargeted[1]} promo/spam messages.`
    );
  }
  if (topDomains.length > 0) {
    const domainList = topDomains
      .map(([domain, count]) => `${domain} (${count})`)
      .join(", ");
    parts.push(`Top recurring sender domains: ${domainList}.`);
  }

  return parts.join(" ");
};
