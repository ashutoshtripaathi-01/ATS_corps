import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import companyLogo from '@/assets/company logo.png';
import { Button } from '@/components/ui/button';
import { RoleSelectModal } from './RoleSelectModal';
import { BRAND } from '@/constants';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setMobileOpen(false);
    setAuthOpen(true);
  };

  const links = [
    { label: 'Home', href: '/' },
    // { label: 'Candidates', href: '/candidate/dashboard' },
    // { label: 'Employers',  href: '/employer/dashboard' },
    { label: 'About', href: '/' },
    { label: 'Contact', href: '/' },
  ];

  return (
    <>
      <nav className='fixed top-0 left-0 right-0 z-50 bg-[#1a1d1f] hover:bg-[#1a1d1f]/60 border-b border-white/8 shadow-sm transition-all duration-300'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            {/* Logo */}
            <Link to='/' className='flex items-center gap-2 shrink-0'>
              <img
                src={companyLogo}
                alt='Ex-Serviceman Jobs'
                className='w-8 h-8 object-contain'
              />
              <span
                className='font-extrabold text-xl text-white'
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                {BRAND.name}
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className='hidden md:flex items-center gap-6'>
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className='text-sm font-medium text-gray-300 hover:text-[#F7A607] transition-colors animated-underline'
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop Auth Buttons */}
            <div className='hidden md:flex items-center gap-3'>
              <Button
                variant='ghost'
                className='font-semibold text-gray-300 hover:text-[#F7A607] hover:bg-white/8'
                onClick={() => openAuth('login')}
              >
                Login
              </Button>
              <Button
                onClick={() => openAuth('register')}
                className='shadow-md shadow-[#F7A607]/20'
              >
                Register
              </Button>
            </div>

            {/* Mobile hamburger */}
            <button
              className='md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors'
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className='w-5 h-5 text-gray-300' />
              ) : (
                <Menu className='w-5 h-5 text-gray-300' />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className='md:hidden bg-[#1a1d1f] border-t border-white/8 overflow-hidden'
            >
              <div className='px-4 py-3 space-y-1'>
                {links.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    className='flex items-center py-2.5 px-3 rounded-xl text-sm font-medium text-gray-300 hover:text-[#F7A607] hover:bg-white/8 transition-colors'
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className='flex gap-3 pt-3 border-t border-white/8 mt-2'>
                  <Button
                    variant='outline'
                    className='flex-1 border-white/20 text-gray-200 hover:bg-white/10 hover:text-white'
                    onClick={() => openAuth('login')}
                  >
                    Login
                  </Button>
                  <Button
                    className='flex-1'
                    onClick={() => openAuth('register')}
                  >
                    Register
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <RoleSelectModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode={authMode}
      />
    </>
  );
}
