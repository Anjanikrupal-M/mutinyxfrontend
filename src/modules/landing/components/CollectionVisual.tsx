import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";

/**
 * screenRadius is calculated as: deviceWidth * (40/280)
 * 40px is the Framer-designed radius for the 280px reference device.
 * smRadius = mobileWidth * (40/280), lgRadius = desktopWidth * (40/280)
 */
const devices = [
  {
    id: 1,
    shadow: "/creators/hero/extracted_image_34.png",
    screen: "/creators/hero/extracted_image_35.jpg",
    borders: "/creators/hero/extracted_image_36.png",
    sizeClasses: "w-[130px] h-[268px] lg:w-[195px] lg:h-[403px]",
    smRadius: 19,   // 130 * 40/280 ≈ 19
    lgRadius: 28,   // 195 * 40/280 ≈ 28
    delay: 0.2,
  },
  {
    id: 2,
    shadow: "/creators/hero/extracted_image_37.png",
    screen: "/creators/hero/extracted_image_38.jpg",
    borders: "/creators/hero/extracted_image_39.png",
    sizeClasses: "w-[176px] h-[364px] lg:w-[280px] lg:h-[578px]",
    smRadius: 25,   // 176 * 40/280 ≈ 25
    lgRadius: 40,   // 280 * 40/280 = 40
    delay: 0.1,
  },
  {
    id: 3,
    shadow: "/creators/hero/extracted_image_40.png",
    screen: "/creators/hero/extracted_image_41.jpg",
    borders: "/creators/hero/extracted_image_42.png",
    sizeClasses: "w-[200px] h-[413px] lg:w-[330px] lg:h-[682px]",
    smRadius: 29,   // 200 * 40/280 ≈ 29
    lgRadius: 47,   // 330 * 40/280 ≈ 47
    delay: 0,
  },
  {
    id: 4,
    shadow: "/creators/hero/extracted_image_43.png",
    screen: "/creators/hero/extracted_image_44.jpg",
    borders: "/creators/hero/extracted_image_45.png",
    sizeClasses: "w-[176px] h-[364px] lg:w-[280px] lg:h-[578px]",
    smRadius: 25,
    lgRadius: 40,
    delay: 0.1,
  },
  {
    id: 5,
    shadow: "/creators/hero/extracted_image_46.png",
    screen: "/creators/hero/extracted_image_47.jpg",
    borders: "/creators/hero/extracted_image_48.png",
    sizeClasses: "w-[130px] h-[268px] lg:w-[195px] lg:h-[403px]",
    smRadius: 19,
    lgRadius: 28,
    delay: 0.2,
  }
];

/** Returns true when viewport width ≥ 1024px (Tailwind's `lg` breakpoint). */
function useIsLg() {
  const [isLg, setIsLg] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isLg;
}

export function CollectionVisual() {
  const isLg = useIsLg();
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y4 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const y5 = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const yTransforms = [y1, y2, y3, y4, y5];

  return (
    <div ref={sectionRef} className="relative w-full max-w-[1600px] mx-auto overflow-hidden py-10 mt-10">
      <div className="flex flex-row justify-center items-center gap-2 lg:gap-10">
        {devices.map((device, index) => {
          const screenRadius = isLg ? device.lgRadius : device.smRadius;

          return (
            <motion.div
              key={device.id}
              style={{ y: yTransforms[index] }}
              className={`relative flex-none overflow-visible ${device.sizeClasses}`}
            >
              <motion.div
                initial={{ opacity: 0, y: 160 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{ y: -8 }}
                transition={{
                  duration: 0.8,
                  delay: device.delay,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                className="w-full h-full relative cursor-pointer"
              >
                {/* Shadow — framer-6igufk: 162%×116%, bleeds outside frame */}
                <div className="absolute pointer-events-none" style={{ width: "162%", height: "116%", top: 0, left: 0 }}>
                  <img
                    src={device.shadow}
                    alt=""
                    className="w-full h-full object-fill"
                  />
                </div>

                {/* Screen — framer-1czr3j7: 90%×96%, top:1.9%, left:5%, proportional radius */}
                <div
                  className="absolute overflow-hidden"
                  style={{ width: "90%", height: "96%", top: "1.89627%", left: "5%", borderRadius: screenRadius }}
                >
                  <img
                    src={device.screen}
                    alt="App Screen"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* iPhone Borders — framer-14edbi7: 100%×99% */}
                <div className="absolute pointer-events-none" style={{ width: "100%", height: "99%", top: 0, left: 0 }}>
                  <img
                    src={device.borders}
                    alt=""
                    className="w-full h-full object-fill"
                  />
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
