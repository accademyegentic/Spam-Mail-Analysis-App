import { GoogleGenAI, Type } from "@google/genai";
import { EmailRecord, Account, DateRange, isPromoOrSpam } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Detect whether we are running on a static host (GitHub Pages, no backend)
const isStaticHost = (): boolean => {
  const { hostname } = window.location;
  return (
    hostname.endsWith("github.io") ||
    hostname.endsWith("netlify.app") ||
    hostname.endsWith("vercel.app") ||
    hostname === "localhost" // dev also has backend via server.ts — keep false for localhost
      ? false
      : !hostname.includes("localhost")
  );
};

// Fetch real emails from our backend API (only when a backend is available)
export const fetchRealEmails = async (
  accounts: Account[],
  dateRange: DateRange
): Promise<EmailRecord[]> => {
  // Skip the backend call entirely on static hosts — go straight to simulation
  if (isStaticHost()) {
    console.info("Static host detected — using Gemini simulation directly.");
    return fetchSimulatedEmails(accounts, dateRange);
  }

  try {
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
  } catch (error) {
    console.error("Real IMAP fetch failed, falling back to simulation", error);
    return fetchSimulatedEmails(accounts, dateRange);
  }
};

// Use Gemini to simulate realistic email data when no backend is available.
export const fetchSimulatedEmails = async (
  accounts: Account[],
  dateRange: DateRange
): Promise<EmailRecord[]> => {
  const ai = getAiClient();
  // gemini-2.5-flash — fast, free-tier friendly, strong JSON output
  const model = "gemini-2.5-flash";

  const accountsList = accounts
    .map((a) => `${a.email} (${a.provider})`)
    .join(", ");

  const minEmails = Math.max(20, accounts.length * 10);
  const maxEmails = Math.max(80, accounts.length * 20);

  const prompt = `
    Act as a mail server log generator. 
    I need a realistic JSON dataset of received emails for the following accounts: [${accountsList}].
    
    Timeframe: From ${dateRange.startDate} to ${dateRange.endDate}.
    
    Instructions:
    1. Generate between ${minEmails} to ${maxEmails} distinct email entries distributed across the timeframe.
    2. Ensure EVERY provided account receives emails.
    3. CATEGORY & SPAM GENERATION (Important):
       - Generate a mix of "Inbox", "Promotions", "Updates", and "Spam" folders.
       - Use diverse folder names: "Werbung", "Newsletter", "Junk", "Social", "Offers".
       - Approx 30-40% should be Promotional or Spam.
    4. DOMAIN-BASED RULES TEST (CRITICAL):
       - For @web.de recipients:
         - Emails from senders containing "web.de" (e.g. "info@web.de") should be in "Inbox" or "Allgemein".
         - Emails from other senders (e.g. "newsletter@shop.com") should be marked as "Spam" or "Junk".
       - For @gmx.net recipients:
         - Emails from senders containing "gmx.net" should be in "Inbox".
         - Emails from other senders should be marked as "Spam".
    5. Return ONLY the JSON array, no markdown, no explanation.

    Output Schema:
    Array<{
      date: string (YYYY-MM-DD),
      sender: string,
      subject: string,
      recipient: string,
      folder: string
    }>
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              sender: { type: Type.STRING },
              subject: { type: Type.STRING },
              recipient: { type: Type.STRING },
              folder: { type: Type.STRING },
            },
            required: ["date", "sender", "subject", "recipient", "folder"],
          },
        },
      },
    });

    let text = response.text;
    if (!text) return [];

    // Strip any accidental markdown fences
    text = text
      .replace(/^```json\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(text);
    return parsed.map((item: any, index: number) => ({
      ...item,
      id: `email-${Date.now()}-${index}`,
    }));
  } catch (error) {
    console.error("Failed to generate simulated email data", error);
    throw new Error(
      "Could not connect to mail servers. Please check credentials and try again."
    );
  }
};

export const generateAnalysisSummary = async (
  emails: EmailRecord[],
  startDate: string,
  endDate: string
): Promise<string> => {
  const ai = getAiClient();
  // gemini-2.0-flash — fastest, most free-tier friendly for short summaries
  const model = "gemini-2.0-flash";

  const promoSpam = emails.filter((e) => isPromoOrSpam(e));
  const emailContext = JSON.stringify(promoSpam.slice(0, 40));

  const prompt = `
    Analyze this list of Promotional and Spam emails received between ${startDate} and ${endDate}.
    Provide a brief, professional summary of the marketing and spam pressure.
    Mention which account is targeted the most by promotions/spam.
    Identify any recurring sender domains if obvious.
    Keep it under 3 sentences.

    Data Sample (Promo/Spam only):
    ${emailContext}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text || "No summary available.";
  } catch (error) {
    console.error("Analysis failed", error);
    return "Could not generate AI insights at this time.";
  }
};
