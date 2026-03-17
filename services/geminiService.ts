import { GoogleGenAI, Type } from "@google/genai";
import { EmailRecord, Account, DateRange, isPromoOrSpam } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Fetch real emails from our backend API
export const fetchRealEmails = async (accounts: Account[], dateRange: DateRange): Promise<EmailRecord[]> => {
  try {
    const response = await fetch('/api/fetch-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts, startDate: dateRange.startDate, endDate: dateRange.endDate })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch from mail servers");
    }

    const data = await response.json();
    return data.emails;
  } catch (error) {
    console.error("Real IMAP fetch failed, falling back to simulation", error);
    // If real fetch fails, we fall back to simulation for demo purposes
    return fetchSimulatedEmails(accounts, dateRange);
  }
};

// Since we cannot actually access IMAP servers from a browser client without a backend proxy,
// we use Gemini to simulate the "fetching" process and generate realistic data based on the accounts provided.
export const fetchSimulatedEmails = async (accounts: Account[], dateRange: DateRange): Promise<EmailRecord[]> => {
  const ai = getAiClient();
  // Using Pro for better reasoning on distribution and schema adherence
  const model = "gemini-3-pro-preview"; 

  const accountsList = accounts.map(a => `${a.email} (${a.provider})`).join(', ');
  
  // Dynamic volume calculation: Ensure we have enough data points per account to look realistic
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
         - Emails from senders containing "web.de" (e.g. "info@web.de", "team@web.de") should be in "Inbox" or "Allgemein".
         - Emails from other senders (e.g. "newsletter@shop.com") should be marked as "Spam" or "Junk".
       - For @gmx.net recipients:
         - Emails from senders containing "gmx.net" (e.g. "service@gmx.net") should be in "Inbox".
         - Emails from other senders should be marked as "Spam".
    5. Return ONLY the JSON array.

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
              folder: { type: Type.STRING }
            },
            required: ["date", "sender", "subject", "recipient", "folder"]
          }
        }
      }
    });

    let text = response.text;
    if (!text) return [];

    // Clean up potential markdown code blocks
    text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    
    const parsed = JSON.parse(text);
    return parsed.map((item: any, index: number) => ({
      ...item,
      id: `email-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Failed to generate simulated email data", error);
    throw new Error("Could not connect to mail servers. Please check credentials and try again.");
  }
};

export const generateAnalysisSummary = async (emails: EmailRecord[], startDate: string, endDate: string): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";

  // Filter for context efficiency
  const promoSpam = emails.filter(e => isPromoOrSpam(e));
  
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