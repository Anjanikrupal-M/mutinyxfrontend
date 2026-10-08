import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/shared/ui/button'

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    // z-40 keeps it above page content but below dropdowns/dialog overlays (z-50),
    // so it never floats over open modals.
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 animate-in fade-in slide-in-from-bottom-4">
      <Button
        onClick={scrollToTop}
        size="icon"
        className="rounded-full shadow-lg"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  )
}
