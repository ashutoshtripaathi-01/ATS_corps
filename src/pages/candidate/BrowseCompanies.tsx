import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Search,
  MapPin,
  Briefcase,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { getAdminCompanies } from '@/lib/api';

interface Company {
  id: number;
  company_name: string;
  state: string;
  district: string;
  status: string;
  job_count: string;
  created_at: string;
}

export default function BrowseCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAdminCompanies()
      .then((data) =>
        setCompanies(data.filter((c: Company) => c.status === 'active')),
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.company_name.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q)
    );
  });

  return (
    <div className='p-4 sm:p-6 max-w-2xl mx-auto'>
      <div className='mb-5'>
        <h1
          className='text-xl font-extrabold text-gray-900 mb-0.5'
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          Hiring Companies
        </h1>
        <p className='text-sm text-gray-500'>
          Companies registered on Ex-Serviceman Jobs looking for ex-servicemen
        </p>
      </div>

      <div className='relative mb-4'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search by company name or location…'
          className='w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none
            focus:border-[#F7A607] focus:ring-2 focus:ring-[#F7A607]/10 placeholder:text-gray-400 shadow-sm'
        />
      </div>

      {loading && (
        <div className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='h-20 bg-white border border-gray-100 rounded-2xl animate-pulse'
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm'
        >
          <Building2 className='w-10 h-10 text-gray-300 mx-auto mb-3' />
          <p className='text-sm font-semibold text-gray-700 mb-1'>
            No companies found
          </p>
          <p className='text-xs text-gray-400'>
            Companies that register on Ex-Serviceman Jobs will appear here.
          </p>
        </motion.div>
      )}

      {!loading && filtered.length > 0 && (
        <div className='space-y-3'>
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:border-[#F7A607]/40 transition-all cursor-pointer'
              onClick={() => navigate(`/candidate/jobs?company=${c.id}`)}
            >
              <div className='w-11 h-11 rounded-xl bg-[#292e31] flex items-center justify-center shrink-0'>
                <Building2 className='w-5 h-5 text-[#F7A607]' />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='font-bold text-sm text-gray-900 truncate'>
                  {c.company_name}
                </p>
                <p className='text-xs text-gray-500 flex items-center gap-1 mt-0.5'>
                  <MapPin className='w-3 h-3' />
                  {c.district}, {c.state}
                </p>
              </div>
              <div className='text-right shrink-0'>
                <span className='flex items-center gap-1 text-xs font-semibold text-[#F7A607]'>
                  <Briefcase className='w-3 h-3' />
                  {c.job_count} job{Number(c.job_count) !== 1 ? 's' : ''}
                </span>
              </div>
              <ChevronRight className='w-4 h-4 text-gray-300 shrink-0' />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
