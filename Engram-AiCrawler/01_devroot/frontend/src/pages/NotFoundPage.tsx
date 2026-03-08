import { useNavigate } from 'react-router-dom';
import { FaSpider, FaHouse, FaTriangleExclamation } from 'react-icons/fa6';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-4">
      <div className="text-center max-w-lg">
        {/* Animated spider icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-cyan/20 to-plasma/10 border border-cyan/30 flex items-center justify-center">
              <FaSpider className="w-12 h-12 text-cyan/60" aria-hidden="true" />
            </div>
            {/* Corner decorations */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          <FaTriangleExclamation className="w-5 h-5 text-volt" aria-hidden="true" />
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-volt">Error 404</p>
          <FaTriangleExclamation className="w-5 h-5 text-volt" aria-hidden="true" />
        </div>

        <p
          className="text-[6rem] font-display font-bold text-cyan leading-none mb-2 tabular-nums"
          style={{ textShadow: '0 0 40px rgba(80,255,255,0.3)' }}
        >
          404
        </p>

        <h1 className="text-xl font-bold text-text mb-3">Page Not Found</h1>

        <p className="text-text-dim mb-10 max-w-sm mx-auto leading-relaxed">
          The crawler found nothing here. This page doesn&apos;t exist or has been moved.
        </p>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2.5 px-7 py-3 bg-cyan hover:bg-acid text-void font-mono text-sm uppercase tracking-widest font-bold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          <FaHouse className="w-4 h-4" aria-hidden="true" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
