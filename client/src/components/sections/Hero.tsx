import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { ParticleBackground } from '../ui/ParticleBackground';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

function AnimatedStat({ value, label, prefix = '', suffix = '' }: { value: number, label: string, prefix?: string, suffix?: string }) {
  const animatedValue = useAnimatedValue(value);
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="text-3xl md:text-4xl font-display font-bold text-white mb-2 dropdown-shadow">
        {prefix}{animatedValue.toLocaleString()}{suffix}
      </div>
      <div className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden">
      {/* Background Particles */}
      <ParticleBackground />
      
      {/* Gradient Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-primary)]/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[var(--color-accent)]/20 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary-light)] text-sm font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
            </span>
            Sepolia Testnet v1.0 is Live
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6">
            The Next Generation of <br/>
            <span className="text-gradient">Decentralized Finance</span>
          </h1>
          
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
            Trade, earn, and build on the most advanced mock protocol running on Ethereum Sepolia Testnet. Experience lightning-fast transactions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Button size="lg" className="w-full sm:w-auto text-base gap-2">
              Start Trading <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base gap-2">
              <BookOpen className="w-4 h-4" /> View Docs
            </Button>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 max-w-4xl mx-auto glass rounded-2xl p-6 border-t border-white/10 shadow-2xl"
        >
          <AnimatedStat value={15243000} label="Total Value Locked" prefix="$" />
          <AnimatedStat value={4520000} label="24h Volume" prefix="$" />
          <AnimatedStat value={50234} label="Active Users" suffix="+" />
        </motion.div>
      </div>
    </section>
  );
}
