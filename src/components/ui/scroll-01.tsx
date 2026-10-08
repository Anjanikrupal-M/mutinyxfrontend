"use client";

import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useMotionTemplate,
  type MotionValue,
} from "motion/react";
import { useRef, useState, Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ButtonWithIcon } from "@/components/ui/button-with-icon";

type Scroll01Item = {
  tag: string;
  title: string;
  description: string;
  footer: string;
  media: string | React.ReactNode;
  accent?: "brand" | "dark" | "default";
  actionUrl?: string;
  actionText?: string;
};

export interface Scroll01Props {
  title?: React.ReactNode;
  items: Scroll01Item[];
}

function ScrollItem({
  item,
  index,
  setActive,
}: {
  item: Scroll01Item;
  index: number;
  setActive: Dispatch<SetStateAction<number>>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 90%", "end 15%"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [20, -20]);

  const opacityValues = index === 0 ? [1, 0.7, 1, 0] : [0, 0.7, 1, 0];
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    opacityValues,
  );

  const isActive = useTransform(scrollYProgress, (v) => v > 0.4 && v < 0.6);

  useMotionValueEvent(isActive, "change", (v) => {
    if (v) {
      setActive((prev) => (prev === index ? prev : index));
    }
  });

  const accent = item.accent || "default";

  const bgClass =
    accent === "brand"
      ? "bg-brand text-black border-brand/30"
      : accent === "dark"
        ? "bg-foreground text-background border-border/50"
        : "bg-white text-foreground border-border/50";

  const tagClass =
    accent === "brand"
      ? "bg-black/10 text-black/80"
      : accent === "dark"
        ? "bg-white/10 text-white/80"
        : "bg-brand/10 text-brand-700";

  const descClass =
    accent === "brand"
      ? "text-black/70"
      : accent === "dark"
        ? "text-white/60"
        : "text-muted-foreground";

  return (
    <motion.article
      ref={ref}
      style={{ opacity, y }}
      className="flex flex-col items-center justify-center min-h-[80vh] w-full"
    >
      <div className={`p-10 rounded-[2rem] border shadow-lg backdrop-blur-md max-w-md w-full text-left flex flex-col ${bgClass}`}>
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 w-max ${tagClass}`}>
          {item.tag}
        </div>
        <h3 className="mb-4 text-3xl font-semibold tracking-tight leading-tight">{item.title}</h3>
        <p className={`text-base font-medium leading-relaxed mb-8 flex-grow ${descClass}`}>{item.description}</p>
        <p className="text-sm font-semibold mt-auto mb-6">{item.footer}</p>
        {item.actionUrl && item.actionText && (
          <div className="mt-2">
            <Link to={item.actionUrl} className="w-full">
              <ButtonWithIcon
                className={
                  accent === "brand"
                    ? "bg-black text-white hover:bg-black/90 w-full"
                    : accent === "dark"
                      ? "bg-brand text-black hover:bg-brand/90 w-full"
                      : "w-full"
                }
              >
                {item.actionText}
              </ButtonWithIcon>
            </Link>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function TunnelFrame({
  media,
  alt,
  tag,
  index,
  total,
  progress,
}: {
  media: string | React.ReactNode;
  alt: string;
  tag: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  if (index === 0) {
    return (
      <div
        style={{ zIndex: index, pointerEvents: "none" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="h-full w-full overflow-hidden relative">
          {typeof media === "string" ? (
            <img
              src={media}
              alt={alt}
              loading="eager"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-hidden bg-background">
              <div className="transform scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 origin-center w-full h-full flex items-center justify-center pointer-events-auto">
                {media}
              </div>
            </div>
          )}
          <div className="absolute top-6 right-6 bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm border border-border/50 z-10 text-foreground">
            {tag}
          </div>
        </div>
      </div>
    );
  }

  const local = useTransform(
    progress,
    [index / total, (index + 1) / total],
    [0, 1],
  );

  const scale = useTransform(local, [0, 0.8], [0.05, 1]);
  const y = useTransform(local, [0, 0.75], [40, 0]);
  const opacity = useTransform(local, [0, 0.03, 1], [0, 1, 1]);
  const contrast = useTransform(local, [0, 0.7], [2.2, 1]);
  const saturate = useTransform(local, [0, 0.7], [2.6, 1]);
  const filter = useMotionTemplate`contrast(${contrast}) saturate(${saturate})`;

  return (
    <div
      style={{ zIndex: index, pointerEvents: "none" }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <motion.div
        style={{ scale, y, opacity, filter }}
        className="h-full w-full overflow-hidden rounded-[2rem] relative"
      >
        {typeof media === "string" ? (
          <img
            src={media}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-background">
            <div className="transform scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 origin-center w-full h-full flex items-center justify-center pointer-events-auto">
              {media}
            </div>
          </div>
        )}
        <div className="absolute top-6 right-6 bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm border border-border/50 z-10 text-foreground">
          {tag}
        </div>
      </motion.div>
    </div>
  );
}

export function Scroll01({ title, items }: Readonly<Scroll01Props>) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const headerScale = useTransform(scrollYProgress, [0, 0.1], [1, 0.6]);
  const headerOpacity = useTransform(scrollYProgress, [0.9, 1], [1, 0]);

  return (
    <div ref={containerRef} className="relative w-full">
      {title && (
        <div className="sticky top-0 z-50 pt-24 pb-20 w-full pointer-events-none mb-10">
          <motion.div
            className="absolute inset-0 -z-10 bg-background/90 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
            style={{ opacity: headerOpacity }}
          />
          <motion.h2
            className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground text-center origin-top"
            style={{ scale: headerScale, opacity: headerOpacity }}
          >
            {title}
          </motion.h2>
        </div>
      )}

      <div className="space-y-10 md:hidden">
        {items.map((item, index) => (
          <article
            key={`${item.tag}-${index}`}
            className="flex flex-col items-start space-y-4"
          >
            <div className="space-y-2">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 bg-brand/10 text-brand-700">
                {item.tag}
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">{item.title}</h3>
              <p className="text-muted-foreground font-medium">{item.description}</p>
              <p className="text-sm font-semibold pt-2 mb-4">{item.footer}</p>
              {item.actionUrl && item.actionText && (
                <Link to={item.actionUrl} className="w-full mt-2 block">
                  <ButtonWithIcon className="w-full">
                    {item.actionText}
                  </ButtonWithIcon>
                </Link>
              )}
            </div>
            <div className="relative w-full">
              {typeof item.media === "string" ? (
                <img
                  src={item.media}
                  alt={item.title}
                  className="h-72 w-full rounded-2xl object-cover shadow-sm border border-border/50"
                />
              ) : (
                <div className="h-72 w-full rounded-2xl overflow-hidden shadow-sm border border-border/50 bg-background flex items-center justify-center">
                  <div className="transform scale-50 sm:scale-75 origin-center w-full h-full flex items-center justify-center pointer-events-auto">
                    {item.media}
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-border/50 z-10 text-foreground">
                {item.tag}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden gap-10 md:grid md:grid-cols-2 relative mt-16">
        <div className="sticky top-[20vh] max-h-[70vh] h-[70vh] w-full overflow-hidden rounded-[2rem] border border-border/50 shadow-sm">
          {items.map((item, index) => (
            <TunnelFrame
              key={`${item.title}-${index}`}
              media={item.media}
              alt={item.title}
              tag={item.tag}
              index={index}
              total={items.length}
              progress={scrollYProgress}
            />
          ))}
        </div>

        <div className="py-[10vh]">
          <div className="flex flex-col w-full">
            {items.map((item, index) => (
              <ScrollItem
                key={`${item.title}-${index}`}
                item={item}
                index={index}
                setActive={setActiveIndex}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Scroll01;
