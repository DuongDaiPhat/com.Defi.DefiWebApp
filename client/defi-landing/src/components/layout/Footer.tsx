import { Github, Twitter, Disc as Discord } from 'lucide-react';
import DefiLogo from '../../assets/defi-logo.png';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[var(--color-bg)] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          
          <div className="flex flex-col items-center md:items-start max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                <img src={DefiLogo} alt="DeFi Protocol" className="w-full h-full object-contain" />
              </div>
              <span className="font-display font-bold text-xl text-white">DeFi Protocol</span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] text-center md:text-left leading-relaxed">
              Trang đích frontend thử nghiệm kiến trúc Smart Contract chạy trên nền tảng Ethereum Sepolia Testnet.
            </p>
          </div>

          <div className="flex gap-6">
            <a href="#" className="text-[var(--color-text-muted)] hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="#" className="text-[var(--color-text-muted)] hover:text-[#1DA1F2] transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="#" className="text-[var(--color-text-muted)] hover:text-[#5865F2] transition-colors">
              <Discord className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <p>© 2026 DeFi Protocol Research Project. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
