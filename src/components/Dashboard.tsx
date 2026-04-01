import React, { useState, useMemo } from 'react';
import { EmailRecord, AnalysisSummary, LoadingState, Account, isPromoOrSpam } from '../types';
import { markEmailsAsRead } from '../services/emailService';
import { Mail, CalendarCheck, Lightbulb, ShieldAlert, Users, ArrowRight, Search, X, TrendingUp, Inbox, CheckCheck, Check, Loader } from 'lucide-react';

interface DashboardProps {
  filteredEmails: EmailRecord[];
  summary: AnalysisSummary | null;
  loadingState: LoadingState;
  accounts: Account[];
}

export const Dashboard: React.FC<DashboardProps> = ({ filteredEmails, summary, loadingState, accounts }) => {
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Mark-as-read state — completely independent from all counting/filtering logic
  const [readEmailIds, setReadEmailIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [markingState, setMarkingState] = useState<'idle' | 'loading' | 'done'>('idle');

  const getClientName = (email: string) => {
    const account = accounts.find(a => a.email === email);
    return account?.client || email;
  };

  const accountSpecificEmails = useMemo(() => {
    if (!selectedAccountEmail) return [];
    return filteredEmails.filter(e => e.recipient === selectedAccountEmail);
  }, [filteredEmails, selectedAccountEmail]);

  // Reset checkboxes whenever the detail panel switches accounts
  const handleSelectAccount = (email: string | null) => {
    setSelectedAccountEmail(email);
    setCheckedIds(new Set());
    setMarkingState('idle');
  };

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCheckAll = (emails: EmailRecord[]) => {
    const allIds = emails.map(e => e.id);
    const allChecked = allIds.every(id => checkedIds.has(id));
    setCheckedIds(allChecked ? new Set() : new Set(allIds));
  };

  const handleMarkRead = async (targetEmails: EmailRecord[]) => {
    if (targetEmails.length === 0) return;
    setMarkingState('loading');
    const toMark = targetEmails.map(e => ({ emailId: e.id, folder: e.folder, recipient: e.recipient }));
    try {
      await markEmailsAsRead(accounts, toMark);
    } catch (_) {
      // Even if the API fails, mark them locally so the UI reflects intent
    }
    setReadEmailIds(prev => {
      const next = new Set(prev);
      targetEmails.forEach(e => next.add(e.id));
      return next;
    });
    setCheckedIds(new Set());
    setMarkingState('done');
  };

  const filteredAccountEmails = useMemo(() => {
    if (!searchTerm) return accountSpecificEmails;
    const lower = searchTerm.toLowerCase();
    return accountSpecificEmails.filter(e =>
      e.subject.toLowerCase().includes(lower) ||
      e.sender.toLowerCase().includes(lower) ||
      e.folder.toLowerCase().includes(lower)
    );
  }, [accountSpecificEmails, searchTerm]);

  if (loadingState === LoadingState.IDLE || (loadingState === LoadingState.PARSING && !filteredEmails.length)) {
    return (
      <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-40 scale-150" />
          <div className="relative p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
            <Mail className="w-10 h-10 text-indigo-400" />
          </div>
        </div>
        <p className="text-slate-500 font-medium text-sm">Enter credentials and select a date range</p>
        <p className="text-slate-400 text-xs mt-1">to view analysis results</p>
      </div>
    );
  }

  // Aggregate chart data
  const chartDataMap = new Map<string, number>();
  const chartSortedEmails = [...filteredEmails].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  chartSortedEmails.forEach(email => {
    chartDataMap.set(email.date, (chartDataMap.get(email.date) || 0) + 1);
  });

  // Aggregate account stats
  const accountStats = new Map<string, { total: number, inbox: number, promoSpam: number }>();
  accounts.forEach(acc => {
    accountStats.set(acc.email, { total: 0, inbox: 0, promoSpam: 0 });
  });
  filteredEmails.forEach(email => {
    const stats = accountStats.get(email.recipient);
    if (stats) {
      stats.total++;
      if (isPromoOrSpam(email)) { stats.promoSpam++; } else { stats.inbox++; }
    }
  });
  const accountStatsArray = accounts.map(acc => ({
    email: acc.email,
    ...(accountStats.get(acc.email) || { total: 0, inbox: 0, promoSpam: 0 })
  }));

  const isAnalyzing = loadingState === LoadingState.ANALYZING;
  const totalSpam = filteredEmails.filter(e => isPromoOrSpam(e)).length;
  const spamRate = filteredEmails.length > 0 ? Math.round((totalSpam / filteredEmails.length) * 100) : 0;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Analyzed */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <TrendingUp className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{filteredEmails.length.toLocaleString()}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Total Analyzed</p>
          </div>
        </div>

        {/* Promo & Spam */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-50 rounded-xl">
                <ShieldAlert className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                {spamRate}% rate
              </span>
            </div>
            <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{totalSpam.toLocaleString()}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Promo & Spam</p>
          </div>
        </div>

        {/* Busiest Day */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1 bg-gradient-to-r from-purple-400 to-indigo-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-50 rounded-xl">
                <CalendarCheck className="w-4 h-4 text-purple-600" />
              </div>
              <Inbox className="w-4 h-4 text-purple-300" />
            </div>
            <p className="text-xl font-extrabold text-slate-800 tracking-tight truncate">
              {summary ? summary.busiestDay : '—'}
            </p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Busiest Day</p>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-blue-50 to-white p-6 shadow-sm">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <div className="p-2.5 bg-white rounded-xl shadow-sm border border-indigo-100 flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-indigo-900 font-bold mb-1 text-sm">AI Analysis Insights</h3>
            {isAnalyzing ? (
              <div className="space-y-2 mt-2">
                <div className="h-3 bg-indigo-200/60 rounded-full animate-pulse w-full" />
                <div className="h-3 bg-indigo-200/60 rounded-full animate-pulse w-4/5" />
                <div className="h-3 bg-indigo-200/40 rounded-full animate-pulse w-3/5" />
              </div>
            ) : (
              <p className="text-indigo-800 text-sm leading-relaxed">
                {summary?.aiInsights || "Generate data to see AI-powered insights regarding your email traffic."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Volume by Account */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            Volume by Account
          </h3>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            {accountStatsArray.length} account{accountStatsArray.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Inbox</th>
                <th className="px-6 py-3 text-xs font-semibold text-orange-400 uppercase tracking-wider text-right">Promo/Spam</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Total</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {accountStatsArray.map((stat, idx) => (
                <tr
                  key={idx}
                  className={`cursor-pointer group transition-colors ${selectedAccountEmail === stat.email ? 'bg-indigo-50/70' : 'hover:bg-slate-50/70'}`}
                  onClick={() => handleSelectAccount(stat.email === selectedAccountEmail ? null : stat.email)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-700 text-xs font-extrabold border border-indigo-200/50 shadow-sm flex-shrink-0">
                        {getClientName(stat.email).substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate max-w-[180px]" title={stat.email}>
                          {getClientName(stat.email)}
                        </p>
                        {getClientName(stat.email) !== stat.email && (
                          <p className="text-xs text-slate-400 truncate max-w-[150px]">{stat.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">{stat.inbox}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-orange-500">{stat.promoSpam}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-bold text-slate-800">{stat.total}</span>
                      <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-400 to-red-400 h-full rounded-full transition-all"
                          style={{ width: stat.total > 0 ? `${(stat.promoSpam / stat.total) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${selectedAccountEmail === stat.email ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'}`}>
                      <span>{selectedAccountEmail === stat.email ? 'Viewing' : 'Analyze'}</span>
                      <ArrowRight className={`w-3.5 h-3.5 transition-transform ${selectedAccountEmail === stat.email ? 'rotate-90' : ''}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Details */}
      {selectedAccountEmail && (
        <div className="bg-white rounded-2xl border border-indigo-200/60 shadow-sm overflow-hidden animate-slide-up">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {getClientName(selectedAccountEmail)}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{selectedAccountEmail}</p>
            </div>
            <button
              onClick={() => setSelectedAccountEmail(null)}
              className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6">
            {/* Search + Mark-as-Read controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                  Total: {accountSpecificEmails.length}
                </span>
                <span className="text-xs font-bold px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
                  Spam: {accountSpecificEmails.filter(e => isPromoOrSpam(e)).length}
                </span>
                {readEmailIds.size > 0 && (
                  <span className="text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {[...readEmailIds].filter(id => accountSpecificEmails.some(e => e.id === id)).length} marked read
                  </span>
                )}
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search subjects or senders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
                />
              </div>
            </div>

            {/* Mark-as-Read action bar */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => handleMarkRead(filteredAccountEmails.filter(e => !readEmailIds.has(e.id)))}
                disabled={markingState === 'loading' || filteredAccountEmails.every(e => readEmailIds.has(e.id))}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {markingState === 'loading' ? (
                  <><Loader className="w-3.5 h-3.5 animate-spin" /> Marking...</>
                ) : (
                  <><CheckCheck className="w-3.5 h-3.5" /> Mark All as Read</>
                )}
              </button>

              {checkedIds.size > 0 && (
                <button
                  onClick={() => handleMarkRead(filteredAccountEmails.filter(e => checkedIds.has(e.id) && !readEmailIds.has(e.id)))}
                  disabled={markingState === 'loading'}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Mark Selected ({checkedIds.size}) as Read
                </button>
              )}

              {checkedIds.size > 0 && (
                <button
                  onClick={() => setCheckedIds(new Set())}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={filteredAccountEmails.length > 0 && filteredAccountEmails.every(e => checkedIds.has(e.id))}
                        onChange={() => toggleCheckAll(filteredAccountEmails)}
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Folder</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sender</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAccountEmails.map(email => {
                    const isSpam = isPromoOrSpam(email);
                    const isRead = readEmailIds.has(email.id);
                    const isChecked = checkedIds.has(email.id);
                    return (
                      <tr
                        key={email.id}
                        className={`transition-colors ${isRead ? 'bg-emerald-50/40' : isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50/70'}`}
                      >
                        <td className="px-3 py-3">
                          {isRead ? (
                            <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center">
                              <Check className="w-3 h-3 text-emerald-600" />
                            </div>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheck(email.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap font-mono text-xs ${isRead ? 'text-slate-400' : 'text-slate-500'}`}>{email.date}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                            isSpam
                              ? 'bg-orange-50 text-orange-600 border border-orange-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            {email.folder}
                          </span>
                        </td>
                        <td className={`px-4 py-3 max-w-[140px] truncate text-xs ${isRead ? 'text-slate-400' : 'text-slate-600'}`} title={email.sender}>{email.sender}</td>
                        <td className={`px-4 py-3 max-w-sm truncate ${isRead ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`} title={email.subject}>{email.subject}</td>
                      </tr>
                    );
                  })}
                  {filteredAccountEmails.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No emails found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
