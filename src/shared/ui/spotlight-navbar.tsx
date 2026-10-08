import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight, ChevronDown, ArrowUpRight } from "lucide-react";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export interface DropdownSubItem {
  label: string;
  href: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  ctaText?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  children?: DropdownSubItem[];
}

export interface SpotlightNavbarProps {
  items: NavItem[];
  logo?: React.ReactNode;
  actions?: React.ReactNode;
  mobileExtraItems?: { label: string; href: string; className?: string }[];
  className?: string;
}

/**
 * SpotlightNavbar — a single unified pill navbar with:
 * - Logo slot on the left
 * - Nav links in the center with mouse-following spotlight + active ambience effect
 * - Dropdown flyouts for multi-item links (e.g. Solutions)
 * - Actions slot on the right
 * - Scroll-aware: active item updates automatically via IntersectionObserver
 */
export function SpotlightNavbar({
  items,
  logo,
  actions,
  mobileExtraItems,
  className,
}: SpotlightNavbarProps) {
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  // -1 = no active item (initial state before user scrolls/clicks)
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setOpenDropdown(null);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobileMenuOpen]);

  // Click outside to close open dropdown
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const spotlightX = useRef(0);
  const ambienceX = useRef(0);

  // --- Scroll-aware active section detection via IntersectionObserver ---
  useEffect(() => {
    const sectionIds = items
      .filter((item) => item.href && item.href.startsWith("#"))
      .map((item) => item.href!.substring(1));

    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            // Find the original index in items array
            const itemIdx = items.findIndex((item) => item.href === `#${id}`);
            if (itemIdx !== -1) setActiveIndex(itemIdx);
          }
        },
        { threshold: 0.35, rootMargin: "-80px 0px 0px 0px" }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  // --- Mouse spotlight effect on the entire navbar ---
  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const rect = nav.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverX(x);
      spotlightX.current = x;
      nav.style.setProperty("--spotlight-x", `${x}px`);
    };

    const handleMouseLeave = () => {
      setHoverX(null);
      if (activeIndex < 0) return;
      const activeItem = nav.querySelector(`[data-index="${activeIndex}"]`);
      if (activeItem) {
        const navRect = nav.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const targetX = itemRect.left - navRect.left + itemRect.width / 2;
        animate(spotlightX.current, targetX, {
          type: "spring",
          stiffness: 200,
          damping: 20,
          onUpdate: (v) => {
            spotlightX.current = v;
            nav.style.setProperty("--spotlight-x", `${v}px`);
          },
        });
      }
    };

    nav.addEventListener("mousemove", handleMouseMove);
    nav.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      nav.removeEventListener("mousemove", handleMouseMove);
      nav.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [activeIndex]);

  // --- Ambience bottom line springs to active nav item ---
  useEffect(() => {
    if (!navRef.current || activeIndex < 0) return;
    const nav = navRef.current;
    const activeItem = nav.querySelector(`[data-index="${activeIndex}"]`);
    if (activeItem) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const targetX = itemRect.left - navRect.left + itemRect.width / 2;
      animate(ambienceX.current, targetX, {
        type: "spring",
        stiffness: 200,
        damping: 20,
        onUpdate: (v) => {
          ambienceX.current = v;
          nav.style.setProperty("--ambience-x", `${v}px`);
        },
      });
    }
  }, [activeIndex]);

  const handleNavigate = (href: string) => {
    if (href.startsWith("#")) {
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        if ((window as any).__lenis) {
          (window as any).__lenis.scrollTo(targetElement, { offset: -90 });
        } else {
          const elementPosition =
            targetElement.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: elementPosition - 90, behavior: "smooth" });
        }
      } else {
        navigate(`/${href}`);
      }
    } else if (href.startsWith("http")) {
      window.location.href = href;
    } else {
      navigate(href);
    }
  };

  const handleItemClick = (item: NavItem, index: number) => {
    setActiveIndex(index);
    if (item.href) {
      handleNavigate(item.href);
    }
  };

  const handleDropdownEnter = (idx: number) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setOpenDropdown(idx);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 160);
  };

  const handleMobileItemClick = (item: NavItem, index: number) => {
    setIsMobileMenuOpen(false);
    handleItemClick(item, index);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
    exit: {
      opacity: 0,
      transition: { staggerChildren: 0.05, staggerDirection: -1 },
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -30 },
    show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, x: -10, transition: { duration: 0.2 } }
  };

  return (
    <>
      <div className="fixed top-5 inset-x-0 z-[100] flex justify-center px-3 sm:px-4 pointer-events-none">
        <motion.header
          ref={navRef}
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn(
            "pointer-events-auto w-full max-w-6xl",
            "flex items-center justify-between",
            "p-2 pr-3 md:pr-4 rounded-full",
            "relative transition-all duration-500",
            isMobileMenuOpen
              ? "bg-transparent border-transparent shadow-none"
              : isScrolled
              ? "border border-border/60 bg-background/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] gap-2"
              : "border border-transparent bg-transparent shadow-none gap-2",
            className
          )}
          style={
            {
              "--spotlight-color": "rgba(128,128,128,0.07)",
              "--ambience-color": "rgba(0,0,0,0.35)",
            } as React.CSSProperties
          }
        >
          {/* Internal rounded mask for mouse spotlight and ambience bottom-line */}
          <div className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-300"
              style={{
                opacity: hoverX !== null ? 1 : 0,
                background: `radial-gradient(120px circle at var(--spotlight-x) 50%, var(--spotlight-color) 0%, transparent 70%)`,
              }}
            />
            <div
              className={cn(
                "pointer-events-none absolute bottom-0 left-0 w-full h-[2px] z-[2] transition-opacity duration-500",
                isMobileMenuOpen ? "opacity-0" : "opacity-100"
              )}
              style={{
                opacity: activeIndex >= 0 && !isMobileMenuOpen ? 1 : 0,
                background: `radial-gradient(60px circle at var(--ambience-x) 0%, var(--ambience-color) 0%, transparent 100%)`,
              }}
            />
          </div>

          {/* Logo slot */}
          {logo && <div className="shrink-0 relative z-10">{logo}</div>}

          {/* Nav links — center */}
          <nav className="hidden md:flex items-center gap-0.5 relative z-10">
            {items.map((item, idx) => {
              const hasDropdown = Boolean(item.children && item.children.length > 0);

              if (hasDropdown) {
                return (
                  <div
                    key={idx}
                    className="relative"
                    onMouseEnter={() => handleDropdownEnter(idx)}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <button
                      type="button"
                      data-index={idx}
                      onClick={() => setOpenDropdown((prev) => (prev === idx ? null : idx))}
                      className={cn(
                        "px-3.5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                        openDropdown === idx || activeIndex === idx
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-expanded={openDropdown === idx}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 transition-transform duration-200 opacity-70",
                          openDropdown === idx ? "rotate-180 text-foreground opacity-100" : ""
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {openDropdown === idx && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96, x: "-50%" }}
                          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                          exit={{ opacity: 0, y: 6, scale: 0.96, x: "-50%" }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="absolute top-full left-1/2 pt-2 z-50 pointer-events-auto"
                        >
                          <div className="w-[380px] sm:w-[410px] p-2 bg-background/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.14)] grid grid-cols-2 gap-2">
                            {item.children?.map((sub, sIdx) => (
                              <a
                                key={sIdx}
                                href={sub.href}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenDropdown(null);
                                  handleNavigate(sub.href);
                                }}
                                className="group flex flex-col justify-between p-3 rounded-xl border border-border/40 hover:border-brand/60 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-brand/[0.06] transition-all duration-200 cursor-pointer text-left"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    {sub.icon && (
                                      <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand-700 dark:text-brand-400 group-hover:bg-brand group-hover:text-black flex items-center justify-center transition-all duration-200 shadow-xs">
                                        {sub.icon}
                                      </div>
                                    )}
                                    <div className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center opacity-60 group-hover:opacity-100 group-hover:bg-brand group-hover:text-black transition-all duration-200">
                                      <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-xs sm:text-[13px] font-bold text-foreground group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors leading-snug">
                                      {sub.label}
                                    </span>
                                    {sub.badge && (
                                      <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded-full bg-brand/20 text-brand-700">
                                        {sub.badge}
                                      </span>
                                    )}
                                  </div>
                                  {sub.description && (
                                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 font-normal">
                                      {sub.description}
                                    </p>
                                  )}
                                </div>
                                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-1 text-[10.5px] font-semibold text-brand-700 dark:text-brand-400 group-hover:text-black dark:group-hover:text-brand-300 transition-colors">
                                  <span>{sub.ctaText || "Learn more"}</span>
                                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <a
                  key={idx}
                  href={item.href}
                  data-index={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(item, idx);
                  }}
                  className={cn(
                    "px-3.5 py-2 text-sm font-semibold transition-colors duration-200 rounded-full cursor-pointer whitespace-nowrap",
                    activeIndex === idx
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Actions slot & Mobile Menu Toggle */}
          <div className="shrink-0 relative z-10 flex items-center gap-1">
            <div className={cn("transition-opacity duration-300", isMobileMenuOpen ? "opacity-0 pointer-events-none" : "opacity-100")}>
              {actions}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "md:hidden p-2 transition-colors pointer-events-auto relative w-10 h-10 flex items-center justify-center rounded-full",
                isMobileMenuOpen ? "text-black hover:bg-black/10" : "text-foreground hover:bg-muted/50"
              )}
              aria-label="Toggle Menu"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute"
                  >
                    <X className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute"
                  >
                    <Menu className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </motion.header>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: "-100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-100%" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} // Wipe down effect
            className="fixed inset-0 z-[90] bg-white/95 backdrop-blur-2xl text-black flex flex-col pointer-events-auto pt-24"
          >
            {/* Links */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex flex-col px-8 pt-6 pb-8 gap-5 overflow-y-auto flex-1"
            >
              {items.map((item, idx) => {
                if (item.children && item.children.length > 0) {
                  return (
                    <motion.div
                      key={idx}
                      variants={itemVariants}
                      className="border-b border-black/10 pb-4 flex flex-col gap-2"
                    >
                      <span className="text-xs uppercase font-bold tracking-wider text-black/50 px-1">
                        {item.label}
                      </span>
                      <div className="flex flex-col gap-2">
                        {item.children.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              handleNavigate(sub.href);
                            }}
                            className="flex items-center justify-between p-3 rounded-2xl bg-black/5 active:bg-black/10 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {sub.icon && (
                                <div className="p-2 rounded-xl bg-brand/20 text-brand-900">
                                  {sub.icon}
                                </div>
                              )}
                              <div>
                                <div className="text-base font-bold text-black">{sub.label}</div>
                                {sub.description && (
                                  <div className="text-xs text-black/60 line-clamp-1">{sub.description}</div>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-black/40" />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.a
                    key={idx}
                    variants={itemVariants}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleMobileItemClick(item, idx);
                    }}
                    className="flex items-center justify-between text-2xl sm:text-3xl font-semibold border-b border-black/10 pb-5 group"
                  >
                    <span className="group-hover:text-black/70 transition-colors">{item.label}</span>
                    <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7 text-black/30 group-hover:text-black/70 transition-colors transform group-hover:translate-x-1" />
                  </motion.a>
                );
              })}
              {mobileExtraItems && mobileExtraItems.length > 0 && (
                <div className="flex flex-col gap-3 mt-4">
                  {mobileExtraItems.map((item, idx) => (
                    <motion.a
                      key={`extra-${idx}`}
                      variants={itemVariants}
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault();
                        setIsMobileMenuOpen(false);
                        handleNavigate(item.href);
                      }}
                      className={cn("flex items-center justify-between text-base sm:text-lg font-bold px-6 py-4 rounded-2xl group", item.className)}
                    >
                      <span className="transition-colors">{item.label}</span>
                      <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 transition-colors transform group-hover:translate-x-1 opacity-50 group-hover:opacity-100" />
                    </motion.a>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
