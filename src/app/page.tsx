"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AccountInput } from '../components/AccountInput';
import { DateFilter } from '../components/DateFilter';
import { Dashboard } from '../components/Dashboard';
import { fetchRealEmails, generateAnalysisSummary } from '../services/geminiService';
import { EmailRecord, DateRange, AnalysisSummary, LoadingState, Account, isPromoOrSpam } from '../types';
import { Globe, Filter } from 'lucide-react';

export default function Page() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Default range: Last 7 days
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);

  const handleFetch = async (accountList: Account[]) => {
    setLoadingState(LoadingState.PARSING);
    setAccounts(accountList); // Store accounts for context

    try {
      // Pass the current date range request to the real fetcher
      const fetchedEmails = await fetchRealEmails(accountList, dateRange);
      setEmails(fetchedEmails);
      
      setLoadingState(LoadingState.SUCCESS);
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
    }
  };

  const handleDataUpload = (uploadedEmails: EmailRecord[], uploadedAccounts: Account[], detectedRange?: DateRange) => {
    setAccounts(uploadedAccounts);
    setEmails(uploadedEmails);
    
    // Automatically set the date range to cover the uploaded data
    if (detectedRange) {
      setDateRange(detectedRange);
    } else if (uploadedEmails.length > 0) {
      // Fallback if not detected but data exists
      const dates = uploadedEmails.map(e => e.date).sort();
      setDateRange({
        startDate: dates[0],
        endDate: dates[dates.length - 1]
      });
    }

    setLoadingState(LoadingState.SUCCESS);
  };

  /**
   * CORE FILTERING LOGIC
   */
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      // 1. DATE RANGE CHECK
      const inRange = email.date >= dateRange.startDate && email.date <= dateRange.endDate;
      if (!inRange) return false;

      return true;
    });
  }, [emails, dateRange]);

  // Run analysis when filtered emails change
  useEffect(() => {
    const runAnalysis = async () => {
      if (filteredEmails.length === 0) {
        setSummary(null);
        return;
      }

      setLoadingState(LoadingState.ANALYZING);

      const dayCounts = new Map<string, number>();
      filteredEmails.forEach(e => {
         dayCounts.set(e.date, (dayCounts.get(e.date) || 0) + 1);
      });

      const uniqueDays = dayCounts.size || 1; 
      const dailyAvg = filteredEmails.length / uniqueDays;
      
      let busiestDay = '';
      let maxCount = 0;
      dayCounts.forEach((count, day) => {
        if (count > maxCount) {
          maxCount = count;
          busiestDay = day;
        }
      });

      try {
        const aiText = await generateAnalysisSummary(filteredEmails, dateRange.startDate, dateRange.endDate);
        
        setSummary({
          totalCount: filteredEmails.length,
          dailyAverage: dailyAvg,
          busiestDay: busiestDay || 'N/A',
          aiInsights: aiText
        });
        setLoadingState(LoadingState.SUCCESS);
      } catch (err) {
        setSummary({
          totalCount: filteredEmails.length,
          dailyAverage: dailyAvg,
          busiestDay: busiestDay || 'N/A',
          aiInsights: "AI analysis unavailable."
        });
        setLoadingState(LoadingState.SUCCESS);
      }
    };

    const timeoutId = setTimeout(() => {
        runAnalysis();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filteredEmails, dateRange]);

  // Aggregate data for Domain Breakdown
  const domainStatsArray = useMemo(() => {
    const domainStats = new Map<string, number>();
    filteredEmails.forEach(email => {
      if (isPromoOrSpam(email)) {
        const domain = email.sender.includes('@') ? email.sender.split('@')[1].toLowerCase() : 'unknown';
        domainStats.set(domain, (domainStats.get(domain) || 0) + 1);
      }
    });
    return Array.from(domainStats.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 for sidebar
  }, [filteredEmails]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Input & Controls */}
      <div className="lg:col-span-4 space-y-6">
        <AccountInput 
          onFetch={handleFetch} 
          onDataUpload={handleDataUpload}
          loadingState={loadingState} 
        />
        <DateFilter dateRange={dateRange} onDateChange={setDateRange} />

        {/* Top Domains Sidebar Section */}
        {loadingState !== LoadingState.IDLE && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                Top Domains (Promo/Spam)
              </h3>
            </div>
            <div className="p-5">
               {domainStatsArray.length > 0 ? (
                 <div className="space-y-4">
                   {domainStatsArray.map((item, idx) => (
                     <div key={idx} className="flex items-center gap-3">
                       <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-slate-200">
                          {idx + 1}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-slate-700 truncate pr-2">{item.domain}</span>
                            <span className="text-[10px] font-bold text-orange-600">{item.count}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full" 
                              style={{ width: `${(item.count / domainStatsArray[0].count) * 100}%` }}
                            />
                          </div>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center text-slate-400 py-8 text-xs flex flex-col items-center gap-2">
                   <Filter className="w-6 h-6 opacity-20" />
                   No data available.
                 </div>
               )}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Dashboard */}
      <div className="lg:col-span-8">
        <Dashboard 
          filteredEmails={filteredEmails} 
          summary={summary} 
          loadingState={loadingState} 
          accounts={accounts}
        />
      </div>
    </div>
  );
}
