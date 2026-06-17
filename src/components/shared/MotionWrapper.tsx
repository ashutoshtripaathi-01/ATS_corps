import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
}

const staggerChildren = {
  animate: { transition: { staggerChildren: 0.07 } },
}

export const FadeInUp = ({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div variants={fadeInUp} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, delay }} className={className}>
    {children}
  </motion.div>
)

export const FadeIn = ({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div variants={fadeIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3, delay }} className={className}>
    {children}
  </motion.div>
)

export const SlideInLeft = ({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div variants={slideInLeft} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, delay }} className={className}>
    {children}
  </motion.div>
)

export const StaggerContainer = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <motion.div variants={staggerChildren} initial="initial" animate="animate" className={className}>
    {children}
  </motion.div>
)

export const StaggerItem = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <motion.div variants={fadeInUp} transition={{ duration: 0.4 }} className={className}>
    {children}
  </motion.div>
)

export const ScaleOnHover = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }} className={className}>
    {children}
  </motion.div>
)

export const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
)
