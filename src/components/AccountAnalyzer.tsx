import React, { useMemo, useState } from 'react';
import { EmailRecord, isPromoOrSpam } from '../types';
import { ArrowLeft, ShieldAlert, Mail, Globe, Users, TrendingUp, Search, FolderOpen, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Cell as PieCell, Legend } from 'recharts';

interface AccountAnalyzerProps {
  email: string;
  clientName?: string;
  data: EmailRecord[];
  onBack: () => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6'];

export const AccountAnalyzer: React.FC<AccountAnalyzerProps> = ({ email, clientName, data, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Domain Extraction
  const domain = email.includes('@') ? email.split('@')[1] : 'Unknown Domain';
  const providerName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

  // Stats
  const stats = useMemo(() => {
    let spamCount = 0;
    const senders = new Set<string>();
    const senderDomains = new Map<string, number>();
    const folderCounts = new Map<string, number>();

    data.forEach(e => {
      // Spam Count
      if (isPromoOrSpam(e)) spamCount++;
      
      // Sender Unique
      senders.add(e.sender);
      
      // Top Domains
      const sDomain = e.sender.includes('@') ? e.sender.split('@')[1].toLowerCase() : 'unknown';
      senderDomains.set(sDomain, (senderDomains.get(sDomain) || 0) + 1);

      // Folder Counts (Raw)
      const fName = e.folder || 'Unknown';
      folderCounts.set(fName, (folderCounts.get(fName) || 0) + 1);
    });

    const topDomains = Array.from(senderDomains.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const folderStats = Array.from(folderCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      total: data.length,
      spam: spamCount,
      uniqueSenders: senders.size,
      topDomains,
      folderStats
    };
  }, [data]);

  // Chart Data (Time Series)
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(e => {
      map.set(e.date, (map.get(e.date) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  // Filtered List
  const filteredList = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter(e => 
      e.subject.toLowerCase().includes(lower) || 
      e.sender.toLowerCase().includes(lower) ||
      e.folder.toLowerCase().includes(lower)
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{clientName || email}</h2>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Globe className="w-3 h-3" />
            <span>Account: <span className="font-medium text-indigo-600">{email}</span></span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Total Received</div>
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Promo / Spam Detected</div>
          <div className="text-2xl font-bold text-orange-600">{stats.spam}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Unique Senders</div>
          <div className="text-2xl font-bold text-indigo-600">{stats.uniqueSenders}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
           <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Top Sender Domain</div>
           <div className="text-lg font-bold text-slate-700 truncate" title={stats.topDomains[0]?.[0]}>
             {stats.topDomains[0]?.[0] || '-'}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Activity Timeline
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" hide />
                <Tooltip 
                   cursor={{fill: '#f1f5f9'}}
                   contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Domains */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Top Senders
          </h3>
          <div className="space-y-3">
            {stats.topDomains.map(([dom, count], idx) => (
              <div key={dom} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono text-xs w-3">{idx + 1}</span>
                  <span className="text-slate-700 font-medium truncate max-w-[120px]" title={dom}>{dom}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${(count / stats.topDomains[0][1]) * 100}%` }} />
                  </div>
                  <span className="text-slate-500 text-xs w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEW: Folder Distribution Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            Folder Distribution (Raw Count)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Folder Table */}
            <div className="overflow-hidden border border-slate-100 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-medium">
                        <tr>
                            <th className="px-4 py-2">Folder Name</th>
                            <th className="px-4 py-2 text-right">Count</th>
                            <th className="px-4 py-2 text-right">%</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stats.folderStats.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-medium text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        {item.name}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right text-slate-600">{item.value}</td>
                                <td className="px-4 py-2 text-right text-slate-400 text-xs">
                                    {Math.round((item.value / stats.total) * 100)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Pie Chart */}
            <div className="h-[200px] flex items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                        <Pie
                            data={stats.folderStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {stats.folderStats.map((entry, index) => (
                                <PieCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </RePieChart>
                 </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Mail List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-500" />
            Message Log
          </h3>
          <div className="relative w-full sm:w-64">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Folder</th>
                <th className="px-6 py-3">Sender</th>
                <th className="px-6 py-3 w-full">Subject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map(email => {
                const isSpam = isPromoOrSpam(email);
                return (
                  <tr key={email.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">{email.date}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                         isSpam 
                           ? 'bg-orange-50 text-orange-700 border border-orange-100' 
                           : 'bg-blue-50 text-blue-700 border border-blue-100'
                       }`}>
                         {email.folder}
                       </span>
                    </td>
                    <td className="px-6 py-3 text-slate-700">{email.sender}</td>
                    <td className="px-6 py-3 text-slate-600 max-w-md truncate" title={email.subject}>{email.subject}</td>
                  </tr>
                );
              })}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    No emails found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};