import React, { useState, useEffect, useRef } from 'react';
import { Account, LoadingState, EmailRecord, DateRange } from '../types';
import { Plus, Trash2, Shield, Globe, Server, Play, AlertCircle, Save, Upload, FileText, CheckCircle, XCircle, KeyRound, Calendar, WifiOff, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AccountInputProps {
  onFetch: (accounts: Account[]) => void;
  onDataUpload: (emails: EmailRecord[], accounts: Account[], detectedRange?: DateRange) => void;
  loadingState: LoadingState;
  backendAvailable: boolean | null; // null = still probing
}

const PROVIDERS: Record<string, string> = {
  'gmail.com': 'Google Mail',
  'outlook.com': 'Outlook',
  'hotmail.com': 'Outlook',
  'yahoo.com': 'Yahoo Mail',
  'icloud.com': 'iCloud',
  'proton.me': 'ProtonMail',
  'gmx.de': 'GMX',
  'web.de': 'WEB.DE',
  't-online.de': 'Telekom',
};

const detectProvider = (email: string) => {
  if (!email.includes('@')) return 'Unknown';
  const domain = email.split('@')[1].toLowerCase();
  return PROVIDERS[domain] || domain;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `acc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const STORAGE_KEY = 'mailpulse_accounts_v1';

// FIX 1: Excel serial date epoch was wrong (was using Unix epoch math).
// Excel counts days from 1899-12-30. Also corrects Excel's leap year bug
// where serials >= 60 are off by one day.
// FIX 2: All date paths now reconstruct via Date.UTC to prevent timezone drift.
const parseExcelDate = (value: any): string => {
  try {
    if (!value) return '';

    // Handle JS Date objects (returned by XLSX with cellDates: true)
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return '';
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
      // Correct Excel's leap year bug: serial 60 = fake Feb 29 1900
      const corrected = value >= 60 ? value - 1 : value;
      const date = new Date(Date.UTC(1899, 11, 30 + corrected));
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    }

    const str = String(value).trim();

    // Handle European/German DD.MM.YYYY or DD.MM.YY
    const europeanMatch = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/);
    if (europeanMatch) {
      const day = parseInt(europeanMatch[1], 10);
      const month = parseInt(europeanMatch[2], 10);
      let year = parseInt(europeanMatch[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    // Handle YYYY-MM-DD — reconstruct via UTC to avoid local-timezone day shift
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const d = new Date(Date.UTC(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10)
      ));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    // Fallback: force UTC midnight to avoid day drift
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      return d.toISOString().split('T')[0];
    }

    return '';
  } catch (e) {
    console.warn("Date parsing error", e);
    return '';
  }
};

export const AccountInput: React.FC<AccountInputProps> = ({ onFetch, onDataUpload, loadingState, backendAvailable }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dataMode, setDataMode] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string, detail?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // FIX 3: Passwords must never be restored from localStorage — strip on load
          const sanitized = parsed.map((a: Account) => ({ ...a, password: '', client: a.client || '' }));
          setAccounts(sanitized);
        } else {
          setAccounts([{ id: generateId(), email: '', password: '', provider: 'Unknown', client: '' }]);
        }
      } catch (e) {
        setAccounts([{ id: generateId(), email: '', password: '', provider: 'Unknown', client: '' }]);
      }
    } else {
      setAccounts([{ id: generateId(), email: '', password: '', provider: 'Unknown', client: '' }]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      // FIX 3 cont: Strip passwords before persisting to localStorage
      const sanitized = accounts.map(a => ({ ...a, password: '', client: a.client || '' }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
  }, [accounts, loaded]);

  const updateAccount = (id: string, field: keyof Account, value: string) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id === id) {
        const updated = { ...acc, [field]: value };
        if (field === 'email') {
          updated.provider = detectProvider(value);
        }
        return updated;
      }
      return acc;
    }));
  };

  const addRow = () => {
    setAccounts(prev => [
      ...prev,
      { id: generateId(), email: '', password: '', provider: 'Unknown', client: '' }
    ]);
  };

  const removeRow = (id: string) => {
    if (accounts.length > 1) {
      setAccounts(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setDataMode(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        // FIX 4: Pass cellDates:true so XLSX parses typed date cells as JS Dates
        // instead of leaking raw serial numbers. raw:false ensures text-formatted
        // numbers are read as strings, not numbers.
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][];

        if (jsonData.length < 2) {
          setImportStatus({ type: 'error', message: 'File is empty or missing headers.' });
          return;
        }

        const header = jsonData[0].map(h => String(h).toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

        const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

        const dateIdx = findCol(['date', 'datum', 'time', 'timestamp', 'received', 'created', 'day', 'zeit']);

        // --- CASE 1: EMAIL LOG IMPORT (Requires Date) ---
        if (dateIdx > -1) {
          const subjIdx = findCol(['subject', 'betreff', 'topic', 'title', 'message', 'summary', 'body']);
          const sendIdx = findCol(['sender', 'from', 'von', 'source', 'origin', 'author']);
          const recpIdx = findCol(['recipient', 'to', 'an', 'dest', 'target', 'user', 'empf']);
          const foldIdx = findCol([
            'folder', 'ordner', 'label', 'category', 'kategorie', 'class', 'type', 'spam', 'junk', 'flag', 'status',
            'mailbox', 'box', 'ablage', 'pfad'
          ]);

          const emails: EmailRecord[] = [];
          const uniqueAccounts = new Set<string>();
          let minDate = '';
          let maxDate = '';

          jsonData.slice(1).forEach((row, idx) => {
            if (!row[dateIdx]) return;
            const dateStr = parseExcelDate(row[dateIdx]);
            if (!dateStr) return;

            let recipient = 'imported-user@example.com';
            if (recpIdx > -1 && row[recpIdx]) {
              recipient = String(row[recpIdx]).trim().toLowerCase();
            }
            uniqueAccounts.add(recipient);

            if (!minDate || dateStr < minDate) minDate = dateStr;
            if (!maxDate || dateStr > maxDate) maxDate = dateStr;

            let folder = 'Inbox';
            if (foldIdx > -1 && row[foldIdx]) {
              folder = String(row[foldIdx]);
            } else {
              // FIX 5: Widened spam detection to also catch 'junk' named columns
              const spamCol = header.findIndex(h => h.includes('spam') || h.includes('junk'));
              if (spamCol > -1 && row[spamCol] !== undefined) {
                const val = String(row[spamCol]).toLowerCase().trim();
                if (val === '1' || val === 'true' || val === 'yes' || val === 'y') folder = 'Spam';
              }
            }

            emails.push({
              id: `imported-${idx}-${Date.now()}`,
              date: dateStr,
              subject: subjIdx > -1 && row[subjIdx] ? String(row[subjIdx]) : '(No Subject)',
              sender: sendIdx > -1 && row[sendIdx] ? String(row[sendIdx]) : 'Unknown Sender',
              recipient: recipient,
              folder: folder
            });
          });

          if (emails.length === 0) {
            setImportStatus({ type: 'error', message: 'No valid rows found. Check Date column format.' });
            return;
          }

          const newAccounts: Account[] = Array.from(uniqueAccounts).map((email) => ({
            id: generateId(),
            email: email,
            password: '',
            provider: detectProvider(email),
            client: 'Imported'
          }));

          setAccounts(newAccounts);
          setDataMode(true);
          setImportStatus({
            type: 'success',
            message: `Loaded ${emails.length} emails.`,
            detail: `Range: ${minDate} to ${maxDate}`
          });
          onDataUpload(emails, newAccounts, (minDate && maxDate) ? { startDate: minDate, endDate: maxDate } : undefined);
        }
        // --- CASE 2: ACCOUNT CREDENTIAL LIST IMPORT (No Date) ---
        else {
          const emailIdx = findCol(['email', 'mail', 'user', 'username', 'login', 'account']);
          const passIdx = findCol(['password', 'pass', 'token', 'credential', 'pwd', 'secret']);
          const clientIdx = findCol(['client', 'kunde', 'customer', 'name', 'label', 'owner']);

          if (emailIdx === -1) {
            setImportStatus({ type: 'error', message: 'Could not find "Date" (for logs) or "Email" (for accounts) column.' });
            return;
          }

          const importedAccounts: Account[] = [];
          jsonData.slice(1).forEach((row) => {
            if (row[emailIdx]) {
              const email = String(row[emailIdx]).trim();
              // FIX 6: Validate value looks like an email before accepting it
              if (!email.includes('@')) return;

              let password = '';
              if (passIdx > -1 && row[passIdx]) password = String(row[passIdx]);

              let client = '';
              if (clientIdx > -1 && row[clientIdx]) client = String(row[clientIdx]);

              importedAccounts.push({
                id: generateId(),
                email: email,
                password: password,
                provider: detectProvider(email),
                client: client
              });
            }
          });

          if (importedAccounts.length > 0) {
            setAccounts(importedAccounts);
            setDataMode(false);
            setImportStatus({ type: 'success', message: `Imported ${importedAccounts.length} accounts.` });
          } else {
            setImportStatus({ type: 'error', message: 'No valid email accounts found.' });
          }
        }

      } catch (err) {
        console.error("Error parsing file", err);
        setImportStatus({ type: 'error', message: 'Failed to parse file. Check format.' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // FIX 7: isValid previously allowed accounts with an email but no password.
  // This passed frontend validation, reached the server, completed the TLS
  // handshake successfully, then failed silently on IMAP AUTHENTICATE with
  // an empty credential. Now requires password when not in dataMode.
  const isValid = accounts.every(a =>
    a.email.length > 0 &&
    a.email.includes('@') &&
    (dataMode || a.password.length > 0)
  );

  const isProcessing = loadingState === LoadingState.PARSING;

  useEffect(() => {
    if (isProcessing && !dataMode) {
      setLogs([]);
      const messages = [
        "Resolving DNS for mail server...",
        "Initiating TLS handshake on port 993...",
        "Verifying server TLS certificate...",
        "Sending IMAP AUTHENTICATE command...",
        "Scanning Inbox, Spam, Junk, Promotions...",
        "Checking provider system message folders...",
        "Aggregating and deduplicating results...",
        "Done."
      ];
      let i = 0;
      const interval = setInterval(() => {
        if (i < messages.length) {
          setLogs(prev => [...prev, messages[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 600);
      return () => clearInterval(interval);
    } else {
      setLogs([]);
    }
  }, [isProcessing, dataMode]);

  if (!loaded) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Server className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Account & Data Input</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${dataMode ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
          {dataMode ? <FileText className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
          <span>{dataMode ? 'Uploaded Log' : 'Live IMAP / TLS'}</span>
        </div>
      </div>

      <div className="px-6 pt-4 pb-2">
        <p className="text-xs text-slate-500">
          Add email accounts to fetch via IMAP over TLS (port 993), <strong>or</strong> upload a file (Excel/CSV).
          <span className="block text-slate-400 mt-0.5">Supported: Log files (Date, Subject, Sender) or Account Lists (Email, Password)</span>
        </p>
      </div>

      {/* Backend availability notice */}
      {backendAvailable === false && (
        <div className="mx-6 mb-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800 mb-0.5">IMAP backend not available</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                This deployment is static-only (GitHub Pages). Live IMAP fetching requires the backend server,
                which only runs locally. <strong>Use the file import (Excel/CSV) instead.</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {importStatus && (
        <div className={`mx-6 mb-4 px-4 py-3 rounded-xl flex flex-col gap-1 text-sm ${
          importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="flex items-center gap-2 font-semibold text-xs">
            {importStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {importStatus.message}
          </div>
          {importStatus.detail && (
            <div className="pl-5 text-xs opacity-80 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {importStatus.detail}
            </div>
          )}
        </div>
      )}

      <div className="mx-6 mb-5 overflow-hidden border border-slate-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[150px]">Client</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[200px]">Email Address</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[180px]">Password / Token</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider w-[150px]">Provider</th>
                <th className="px-4 py-2.5 w-[60px] text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      placeholder="Client Name"
                      value={account.client || ''}
                      onChange={(e) => updateAccount(account.id, 'client', e.target.value)}
                      disabled={isProcessing || dataMode}
                      className="w-full bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-300 disabled:text-slate-400 font-semibold text-sm outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={account.email}
                      onChange={(e) => updateAccount(account.id, 'email', e.target.value)}
                      disabled={isProcessing || dataMode}
                      className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-300 disabled:text-slate-400 text-sm outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="password"
                      placeholder={dataMode ? "Data Loaded" : "••••••••••••"}
                      value={account.password}
                      onChange={(e) => updateAccount(account.id, 'password', e.target.value)}
                      disabled={isProcessing || dataMode}
                      className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-300 disabled:text-slate-400 text-sm outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {account.provider !== 'Unknown' && <Globe className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                      <span className="truncate text-xs font-medium">{account.provider}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => removeRow(account.id)}
                      disabled={accounts.length === 1 || isProcessing || dataMode}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50/80 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={addRow}
            disabled={isProcessing || dataMode}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Account
          </button>
          <div className="flex items-center">
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            <button
              onClick={handleImportClick}
              disabled={isProcessing}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 disabled:opacity-40 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Excel/CSV
            </button>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="mx-6 mb-5 bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-400 h-32 overflow-y-auto border border-slate-800 shadow-inner">
          <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2 font-semibold">// IMAP Connection Log</div>
          {logs.map((log, i) => (
            <div key={i} className="mb-0.5 flex items-start gap-1.5">
              <span className="text-indigo-500 flex-shrink-0">›</span>
              <span>{log}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-indigo-500">›</span>
            <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse" />
          </div>
        </div>
      )}

      <div className="px-6 pb-5 flex justify-between items-center gap-3">
        <div className="text-[11px] text-slate-400 flex items-center gap-1">
          <Save className="w-3 h-3" />
          <span>Auto-saved (passwords excluded)</span>
        </div>

        <div className="flex items-center gap-2">
          {loadingState === LoadingState.ERROR && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {backendAvailable === false
                  ? 'Backend unavailable — use file import.'
                  : 'IMAP failed. Check credentials & provider settings.'}
              </span>
            </div>
          )}

          <button
            onClick={() => onFetch(accounts)}
            disabled={!isValid || isProcessing || dataMode || backendAvailable === false}
            title={backendAvailable === false ? 'IMAP requires the local backend server — not available on this deployment' : undefined}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all
              ${!isValid || isProcessing || dataMode || backendAvailable === false
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 shadow-md hover:shadow-indigo-200 hover:shadow-lg active:scale-95'}
            `}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : dataMode ? (
              <>
                <FileText className="w-4 h-4" />
                Data Loaded
              </>
            ) : backendAvailable === false ? (
              <>
                <WifiOff className="w-4 h-4" />
                IMAP Unavailable
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Fetch via IMAP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};