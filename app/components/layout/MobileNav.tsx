"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

const navLinks = [
  { name: 'Tính Năng', href: '#features' },
  { name: 'Quy Trình', href: '#workflow' },
  { name: 'Bảng Giá', href: '#pricing' },
  { name: 'FAQ', href: '#faq' },
];

export const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const menuVariants: Variants = {
    closed: {
      opacity: 0,
      x: "100%",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 40
      }
    },
    open: {
      opacity: 1,
      x: "0%",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 40,
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    closed: { opacity: 0, x: 50 },
    open: { opacity: 1, x: 0 }
  };

  return (
    <div className="md:hidden">
      <button
        onClick={toggleMenu}
        className="fixed top-6 right-6 z-50 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg hover:bg-white/20 transition-colors"
        aria-label="Toggle Menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed inset-0 z-40 bg-deep-space/95 backdrop-blur-xl flex flex-col justify-center items-center p-8"
          >
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-10%] left-[-20%] w-[300px] h-[300px] bg-secondary/20 rounded-full blur-[80px]" />
            </div>

            <nav className="flex flex-col gap-8 text-center w-full max-w-sm">
              {navLinks.map((link) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  variants={itemVariants}
                  onClick={() => setIsOpen(false)}
                  className="text-3xl font-heading font-bold text-white hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-primary hover:to-secondary transition-all"
                >
                  {link.name}
                </motion.a>
              ))}

              <motion.div variants={itemVariants} className="pt-8">
                <Button
                    size="lg"
                    className="w-full text-lg"
                    onClick={() => {
                        setIsOpen(false);
                        document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                >
                    Liên Hệ Ngay <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
