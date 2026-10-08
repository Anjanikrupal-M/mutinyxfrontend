import { Link } from "react-router-dom";
import { BackgroundShapes } from "@/components/ui/background-shapes";

export function SiteFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[#0a0a0a] text-white pt-20 pb-10 relative overflow-hidden border-t border-white/5">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <BackgroundShapes
          width={2000}
          height={800}
          colors={["#F5DE4B"]}
          strokeWidth={1.5}
          cellSize={60}
          minInterval={400}
          maxInterval={1500}
          className="w-full h-full"
        />
      </div>

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <div className="flex flex-col lg:flex-row justify-between gap-16 lg:gap-8">

          {/* Logo & Branding */}
          <div className="flex-1 max-w-sm">
            <div
              className="flex items-center gap-3 sm:gap-4 cursor-pointer hover:opacity-80 transition-opacity mb-4 inline-flex"
              onClick={scrollToTop}
            >
              <div className="flex items-center shrink-0 bg-black rounded-full px-4 py-2 shadow-sm border border-white/5">
                <img src="/logo.svg" alt="MutinyX Logo" className="h-4 sm:h-5 w-auto object-contain" />
              </div>
              <div className="w-px h-6 sm:h-8 bg-white/20"></div>
              <span className="text-xs sm:text-sm font-semibold text-white/80">The Collaboration Network</span>
            </div>
            <p className="text-sm text-white/40 mt-4 font-geist">
              Empowering creators and brands to collaborate seamlessly.
            </p>
          </div>

          {/* Links Columns */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-10 lg:gap-8">

            {/* Column 1 */}
            <div className="flex flex-col gap-5">
              <h4 className="text-xs font-bold tracking-wider text-white uppercase">Platform</h4>
              <div className="flex flex-col gap-3">
                <Link to="/for-brands" className="text-sm text-white/60 hover:text-white transition-colors">For Brands</Link>
                <Link to="/creators" className="text-sm text-white/60 hover:text-white transition-colors">For Creators</Link>
                <Link to="/agencies" className="text-sm text-white/60 hover:text-white transition-colors">For Agencies</Link>
              </div>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-5">
              <h4 className="text-xs font-bold tracking-wider text-white uppercase">Resources</h4>
              <div className="flex flex-col gap-3">
                <Link to="/blog" className="text-sm text-white/60 hover:text-white transition-colors">Blog</Link>
                <Link to="/case-studies" className="text-sm text-white/60 hover:text-white transition-colors">Case Studies</Link>
                <Link to="/help" className="text-sm text-white/60 hover:text-white transition-colors">Help Center</Link>
                <Link to="/community" className="text-sm text-white/60 hover:text-white transition-colors">Community</Link>
              </div>
            </div>

            {/* Column 3 */}
            <div className="flex flex-col gap-5">
              <h4 className="text-xs font-bold tracking-wider text-white uppercase">Company</h4>
              <div className="flex flex-col gap-3">
                <Link to="/about" className="text-sm text-white/60 hover:text-white transition-colors">About Us</Link>
                <Link to="/careers" className="text-sm text-white/60 hover:text-white transition-colors">Careers</Link>
                <Link to="/contact" className="text-sm text-white/60 hover:text-white transition-colors">Contact Us</Link>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/40 font-medium">
            © {new Date().getFullYear()} MUTINY TALENT PRIVATE LIMITED. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs text-white/40 hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-white/40 hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
