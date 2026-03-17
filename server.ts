import express from "express";
import { createServer as createViteServer } from "vite";
import { ImapFlow } from "imapflow";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/fetch-emails", async (req, res) => {
    const { accounts, startDate, endDate } = req.body;
    
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ error: "Invalid accounts" });
    }

    const allEmails: any[] = [];
    const errors: string[] = [];

    for (const account of accounts) {
      if (!account.email || !account.password) continue;

      const client = new ImapFlow({
        host: getImapHost(account.email),
        port: 993,
        secure: true,
        auth: {
          user: account.email,
          pass: account.password
        },
        logger: false,
        // Increase timeout for slow servers
        connectionTimeout: 10000,
        greetingTimeout: 10000
      });

      try {
        await client.connect();
        
        // List all mailboxes
        const mailboxes = await client.list();
        
        // We want to check common folders
        const targetFolders = mailboxes.filter(f => {
            const n = f.name.toLowerCase();
            const p = f.path.toLowerCase();
            return n.includes('inbox') || n.includes('spam') || n.includes('junk') || 
                   n.includes('werbung') || p.includes('inbox') || p.includes('spam');
        });

        for (const folder of targetFolders) {
            let lock = await client.getMailboxLock(folder.path);
            try {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                // IMAP search for messages since start date
                // Note: IMAP search is not always precise with timezones, but good enough for volume
                const messages = client.fetch({
                    since: start
                }, {
                    envelope: true,
                    uid: true
                });

                for await (let message of messages) {
                    const msgDate = message.envelope.date;
                    if (msgDate >= start && msgDate <= new Date(end.getTime() + 86400000)) {
                        allEmails.push({
                            id: `imap-${message.uid}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                            date: msgDate.toISOString().split('T')[0],
                            subject: message.envelope.subject || '(No Subject)',
                            sender: message.envelope.from?.[0]?.address || 'Unknown Sender',
                            recipient: account.email,
                            folder: folder.name
                        });
                    }
                }
            } catch (err) {
                console.error(`Error fetching folder ${folder.path}:`, err);
            } finally {
                lock.release();
            }
        }
        await client.logout();
      } catch (err: any) {
        console.error(`Failed to fetch for ${account.email}:`, err);
        errors.push(`${account.email}: ${err.message}`);
      }
    }

    // If we have some emails, we consider it a partial success at least
    if (allEmails.length === 0 && errors.length > 0) {
        return res.status(500).json({ error: "Failed to connect to accounts", details: errors });
    }

    res.json({ emails: allEmails, errors });
  });

  // Helper to guess IMAP host
  function getImapHost(email: string) {
    const domain = email.split('@')[1].toLowerCase();
    if (domain === 'gmail.com') return 'imap.gmail.com';
    if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') return 'outlook.office365.com';
    if (domain === 'yahoo.com') return 'imap.mail.yahoo.com';
    if (domain === 'icloud.com' || domain === 'me.com') return 'imap.mail.me.com';
    if (domain === 'gmx.de' || domain === 'gmx.net') return 'imap.gmx.net';
    if (domain === 'web.de') return 'imap.web.de';
    if (domain === 't-online.de') return 'secureimap.t-online.de';
    return `imap.${domain}`;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
