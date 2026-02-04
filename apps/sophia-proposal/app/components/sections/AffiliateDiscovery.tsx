'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Tag, Zap, Percent } from 'lucide-react';
import { affiliatePrograms } from '@/app/lib/affiliate-data';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

const glowColors = {
  cyan: 'group-hover:shadow-[0_0_20px_rgba(0,245,255,0.5)] group-hover:border-cyan-400/50',
  purple: 'group-hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] group-hover:border-purple-400/50',
  pink: 'group-hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] group-hover:border-pink-400/50',
};

const badgeColors = {
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

export const AffiliateDiscovery = () => {
  return (
    <section className="relative py-24 px-4 overflow-hidden bg-[#0A0A0F]">
      {/* Background Gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              Auto-Discovery Affiliate Network
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Access our curated ecosystem of high-converting tools.
              Earn up to 50% commission with our top-tier partners.
            </p>
          </motion.div>
        </div>

        {/* Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {affiliatePrograms.map((program) => (
            <motion.div
              key={program.id}
              variants={cardVariants}
              className="group relative"
            >
              <div className={`
                h-full p-6 rounded-2xl
                bg-white/5 backdrop-blur-xl
                border border-white/10
                transition-all duration-300 ease-out
                hover:-translate-y-2 hover:bg-white/[0.07]
                ${glowColors[program.color]}
              `}>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300">
                      {program.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Tag className="w-3 h-3" />
                      {program.category}
                    </div>
                  </div>
                  <div className={`
                    px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1
                    ${badgeColors[program.color]}
                  `}>
                    <Percent className="w-3 h-3" />
                    {program.commission}
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-400 mb-6 text-sm leading-relaxed min-h-[40px]">
                  {program.description}
                </p>

                {/* Footer / CTA */}
                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className={`text-xs font-medium uppercase tracking-wider ${
                    program.color === 'cyan' ? 'text-cyan-400' :
                    program.color === 'purple' ? 'text-purple-400' : 'text-pink-400'
                  }`}>
                    Partner Program
                  </span>

                  <a
                    href={program.link}
                    className="
                      flex items-center gap-2 text-sm font-medium text-white
                      opacity-70 group-hover:opacity-100 transition-opacity
                    "
                  >
                    View Details
                    <ExternalLink className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
