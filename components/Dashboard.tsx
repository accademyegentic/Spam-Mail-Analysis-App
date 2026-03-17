import React, { useState, useMemo } from 'react';
import { EmailRecord, AnalysisSummary, LoadingState, Account, isPromoOrSpam } from '../types';
import { Mail, CalendarCheck, Lightbulb, ShieldAlert, Users, ArrowRight, Search, X } from 'lucide-react';

interface DashboardProps {
  filteredEmails: EmailRecord[];
  summary: AnalysisSummary | null;
  loadingState: LoadingState;
  accounts: Account[];
}

export const Dashboard: React.FC<DashboardProps> = ({ filteredEmails, summary, loadingState, accounts }) => {
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getClientName = (email: string) => {
    const account = accounts.find(a => a.email === email);
    return account?.client || email;
  };

  const accountSpecificEmails = useMemo(() => {
    if (!selectedAccountEmail) return [];
    return filteredEmails.filter(e => e.recipient === selectedAccountEmail);
  }, [filteredEmails, selectedAccountEmail]);

  const filteredAccountEmails = useMemo(() => {
    if (!searchTerm) return accountSpecificEmails;
    const lower = searchTerm.toLowerCase();
    return accountSpecificEmails.filter(e => 
      e.subject.toLowerCase().includes(lower) || 
      e.sender.toLowerCase().includes(lower) ||
      e.folder.toLowerCase().includes(lower)
    );
  }, [accountSpecificEmails, searchTerm]);

  // Conditional return for empty/loading states
  if (loadingState === LoadingState.IDLE || (loadingState === LoadingState.PARSING && !filteredEmails.length)) {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <Mail className="w-12 h-12 mb-3 opacity-20" />
        <p>Enter credentials and select a date range to view analysis</p>
      </div>
    );
  }

  // Aggregate data for Chart (Date)
  const chartDataMap = new Map<string, number>();
  const chartSortedEmails = [...filteredEmails].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  chartSortedEmails.forEach(email => {
    const date = email.date;
    chartDataMap.set(date, (chartDataMap.get(date) || 0) + 1);
  });
  const chartData = Array.from(chartDataMap.entries()).map(([date, count]) => ({
    date,
    count
  }));

  // Aggregate data for Account Table
  const accountStats = new Map<string, { total: number, inbox: number, promoSpam: number }>();
  
  // Initialize with all accounts to ensure 0-volume accounts are shown
  accounts.forEach(acc => {
    accountStats.set(acc.email, { total: 0, inbox: 0, promoSpam: 0 });
  });

  filteredEmails.forEach(email => {
    const stats = accountStats.get(email.recipient);
    if (stats) {
      stats.total++;
      if (isPromoOrSpam(email)) {
        stats.promoSpam++;
      } else {
        stats.inbox++;
      }
    }
  });

  // Map back to array using the original accounts order to maintain sequence
  const accountStatsArray = accounts.map(acc => ({
    email: acc.email,
    ...(accountStats.get(acc.email) || { total: 0, inbox: 0, promoSpam: 0 })
  }));

  const isAnalyzing = loadingState === LoadingState.ANALYZING;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-500">Total Analyzed</h3>
          </div>
          <p className="text-2xl font-bold text-slate-800">{filteredEmails.length}</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-500">Promo & Spam</h3>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {filteredEmails.filter(e => isPromoOrSpam(e)).length}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <CalendarCheck className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-500">Busiest Day</h3>
          </div>
          <p className="text-lg font-bold text-slate-800 truncate">
             {summary ? summary.busiestDay : '-'}
          </p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-indigo-900 font-semibold mb-1">AI Insights</h3>
            {isAnalyzing ? (
               <div className="h-4 bg-indigo-200/50 rounded animate-pulse w-3/4 mt-2"></div>
            ) : (
              <p className="text-indigo-800 text-sm leading-relaxed">
                {summary?.aiInsights || "Generate data to see AI-powered insights regarding your email traffic."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Content: Volume Table + Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Volume by Account
              </h3>
              <div className="text-xs text-slate-400">
                Total Accounts: {accountStatsArray.length}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Account</th>
                    <th className="px-6 py-3 text-right">Inbox</th>
                    <th className="px-6 py-3 text-right text-orange-600">Promo/Spam</th>
                    <th className="px-6 py-3 text-right text-slate-800">Total Volume</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountStatsArray.map((stat, idx) => (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50 cursor-pointer group transition-colors ${selectedAccountEmail === stat.email ? 'bg-indigo-50/50' : ''}`}
                      onClick={() => setSelectedAccountEmail(stat.email === selectedAccountEmail ? null : stat.email)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold">
                            {getClientName(stat.email).substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="truncate max-w-[200px] font-bold" title={stat.email}>
                              {getClientName(stat.email)}
                            </span>
                            {getClientName(stat.email) !== stat.email && (
                              <span className="text-xs text-slate-400 truncate max-w-[150px]">{stat.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        {stat.inbox}
                      </td>
                      <td className="px-6 py-4 text-right text-orange-600 font-medium">
                        {stat.promoSpam}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-800">{stat.total}</span>
                          <div className="w-24 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                            <div 
                              className="bg-orange-500 h-full" 
                              style={{ width: stat.total > 0 ? `${(stat.promoSpam / stat.total) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end">
                           <div className={`flex items-center gap-1 font-medium transition-all ${selectedAccountEmail === stat.email ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                              <span className="text-xs">{selectedAccountEmail === stat.email ? 'Viewing' : 'Analyze'}</span>
                              <ArrowRight className={`w-4 h-4 transition-transform ${selectedAccountEmail === stat.email ? 'rotate-90' : ''}`} />
                           </div>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Account Details (Shown below the list) */}
          {selectedAccountEmail && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Details for {getClientName(selectedAccountEmail)}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedAccountEmail}</p>
                </div>
                <button 
                  onClick={() => setSelectedAccountEmail(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                      <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Total: {accountSpecificEmails.length}</span>
                    </div>
                    <div className="bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                      <span className="text-xs text-orange-600 font-semibold uppercase tracking-wider">Spam: {accountSpecificEmails.filter(e => isPromoOrSpam(e)).length}</span>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search subjects or senders..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Folder</th>
                        <th className="px-4 py-3">Sender</th>
                        <th className="px-4 py-3">Subject</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAccountEmails.map(email => {
                        const isSpam = isPromoOrSpam(email);
                        return (
                          <tr key={email.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">{email.date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                               <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                 isSpam 
                                   ? 'bg-orange-50 text-orange-700 border border-orange-100' 
                                   : 'bg-blue-50 text-blue-700 border border-blue-100'
                               }`}>
                                 {email.folder}
                               </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-[150px] truncate" title={email.sender}>{email.sender}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-md truncate" title={email.subject}>{email.subject}</td>
                          </tr>
                        );
                      })}
                      {filteredAccountEmails.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
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
      </div>
    </div>
  );
};