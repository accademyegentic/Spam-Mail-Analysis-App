import React, { useState, useEffect, useMemo } from 'react';
import { AccountInput } from './components/AccountInput';
import { DateFilter } from './components/DateFilter';
import { Dashboard } from './components/Dashboard';
import { fetchRealEmails, generateAnalysisSummary } from './services/geminiService';
import { EmailRecord, DateRange, AnalysisSummary, LoadingState, Account } from './types';
import { LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
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

  // Filter emails based on range (client-side filtering)
  // Uses string comparison (lexicographical) for date YYYY-MM-DD which is timezone safe
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      return email.date >= dateRange.startDate && email.date <= dateRange.endDate;
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

      // Basic stats calculation (Synchronous)
      const dayCounts = new Map<string, number>();
      filteredEmails.forEach(e => {
         dayCounts.set(e.date, (dayCounts.get(e.date) || 0) + 1);
      });

      const uniqueDays = dayCounts.size || 1; // Avoid divide by zero
      const dailyAvg = filteredEmails.length / uniqueDays;
      
      let busiestDay = '';
      let maxCount = 0;
      dayCounts.forEach((count, day) => {
        if (count > maxCount) {
          maxCount = count;
          busiestDay = day;
        }
      });

      // AI Summary (Asynchronous)
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
               <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">
              MailPulse Analytics
            </h1>
          </div>
          <div className="text-sm text-slate-500">
             Powered by Gemini 3
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-4 space-y-6">
            <AccountInput 
              onFetch={handleFetch} 
              onDataUpload={handleDataUpload}
              loadingState={loadingState} 
            />
            <DateFilter dateRange={dateRange} onDateChange={setDateRange} />
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

      </main>
    </div>
  );
};

export default App;