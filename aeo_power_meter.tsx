'use client';

import { useBuilder } from '@/lib/builder_context';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AeoPowerMeter() {
  const { schema } = useBuilder();
  const score = schema.aeoPowerScore;
  const [flashing, setFlashing] = useState(false);
  const [prevScore, setPrevScore] = useState(score);

  useEffect(() => {
    if (score < prevScore) {
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 1200);
      return () => clearTimeout(t);
    }
    setPrevScore(score);
  }, [score, prevScore]);

  const color = flashing ? 'var(--aeo-warn)' : score > 70 ? 'var(--aeo-green)' : score > 40 ? 'var(--aeo-gold)' : 'var(--aeo-blue)';
  const fillClass = flashing ? 'animate-power-flash' : '';

  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3 hidden lg:flex">
      {/* Label */}
      <div className="text-[9px] font-mono tracking-[0.18em] uppercase text-[var(--muted-foreground)] rotate-180"
        style={{ writingMode: 'vertical-rl' }}>
        AEO Power
      </div>

      {/* Track */}
      <div className="relative w-2 h-48 bg-[var(--muted)] rounded-full overflow-hidden">
        <motion.div
          className={`absolute bottom-0 left-0 right-0 rounded-full ${fillClass}`}
          style={{ background: color }}
          initial={{ height: '0%' }}
          animate={{ height: `${score}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map(tick => (
          <div key={tick} className="absolute left-0 right-0 h-px bg-white/40"
            style={{ bottom: `${tick}%` }} />
        ))}
      </div>

      {/* Icon */}
      <AnimatePresence mode="wait">
        {flashing ? (
          <motion.div key="warn" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <AlertTriangle size={14} className="text-[var(--aeo-warn)]" />
          </motion.div>
        ) : (
          <motion.div key="zap" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Zap size={14} style={{ color }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score */}
      <motion.div
        key={score}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        className="text-xs font-bold tabular-nums"
        style={{ color }}>
        {score}
      </motion.div>
    </div>
  );
}
