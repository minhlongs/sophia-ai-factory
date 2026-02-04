import React from 'react';
import { Container } from '../ui/Container';
import { Mail, Phone, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';

export const Footer = () => {
  return (
    <footer id="footer" className="py-12 border-t border-white/10 bg-black/50">
      <Container>
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold font-heading mb-2">AgencyOS</h3>
            <p className="text-gray-500 text-sm">
              Empowering creators with AI Automation
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <a href="mailto:contact@agencyos.ai" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <Mail className="w-4 h-4" /> contact@agencyos.ai
            </a>
            <a href="#" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <Phone className="w-4 h-4" /> 098.xxx.xxxx (Zalo)
            </a>
          </div>

          <div>
            <Button onClick={() => window.open('https://calendly.com', '_blank')}>
              <Calendar className="w-4 h-4 mr-2" /> Book a Call
            </Button>
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-gray-700">
          © {new Date().getFullYear()} AgencyOS. All rights reserved.
        </div>
      </Container>
    </footer>
  );
};
