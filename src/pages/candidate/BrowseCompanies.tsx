import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Search, MapPin, Briefcase, ChevronRight, RefreshCw } from 'lucide-react';
import { getAdminCompanies } from '@/lib/api';

interface Company {
  id: number; company_name: string; state: string; district: string;
  status: string; job_count: string; created_at: string;
}

export default function BrowseCompanies() {
  const navigate  = useNavigate();
  const [companies, setCompanies]= useState<Company[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [search,    setSearch]   = useState('');

  const load = () => {
    setLoading(true);
    getAdminCompanies()
      .then(data => setCompanies(data.filter((c: Company) => c.status === 'active')))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    return !q || c.company_name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q) || c.state.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#13161a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-[#F0EFEA]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Hiring Companies
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? 'Loading…' : `${filtered.length} active compan${filtered.length !== 1 ? 'ies' : 'y'} registered`}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by company or location…"
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2227] text-sm outline-none
                  focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400 shadow-sm"
              />
            </div>
            <button onClick={load} className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e2227] flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-24 bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-16 text-center shadow-sm max-w-lg mx-auto"
          >
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">No companies found</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {search ? `No results for "${search}"` : 'Companies that register on Ex-Serviceman Jobs will appear here.'}
            </p>
          </motion.div>
        )}

        {/* Company cards — 3-col on large screens */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                onClick={() => navigate(`/candidate/jobs?company=${c.id}`)}
                className="bg-white dark:bg-[#1e2227] border border-gray-100 dark:border-white/8 rounded-2xl p-5 shadow-sm flex items-start gap-4 hover:border-[#F7A607]/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-[#F7A607]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-[#F0EFEA] truncate group-hover:text-[#F7A607] transition-colors">
                    {c.company_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />{c.district}, {c.state}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#F7A607]">
                      <Briefcase className="w-3 h-3" />{c.job_count} job{Number(c.job_count) !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#F7A607] transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
