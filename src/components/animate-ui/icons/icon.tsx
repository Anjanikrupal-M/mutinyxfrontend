'use client';

import * as React from 'react';
import { useAnimation, type Variants, type SVGMotionProps } from 'framer-motion';

export interface IconProps<T extends string = 'default'> extends SVGMotionProps<SVGSVGElement> {
  size?: number | string;
  variant?: T;
  onHover?: () => void;
  onMouseLeave?: () => void;
  className?: string;
  isHovered?: boolean;
}

interface AnimateIconContextType {
  controls: any;
  isHovered: boolean;
}

const AnimateIconContext = React.createContext<AnimateIconContextType | undefined>(undefined);

export function useAnimateIconContext() {
  const context = React.useContext(AnimateIconContext);
  if (!context) {
    throw new Error('useAnimateIconContext must be used within an IconWrapper');
  }
  return context;
}

export function getVariants<T extends string>(
  animations: Record<string, Record<string, Variants>>,
  variant: string = 'default'
) {
  return animations[variant] || animations.default;
}

export function IconWrapper<T extends string>({
  icon: Icon,
  variant = 'default' as T,
  onHover,
  onMouseLeave,
  onMouseEnter,
  size = 24,
  className,
  isHovered: externalIsHovered,
  ...props
}: IconProps<T> & { icon: React.ComponentType<IconProps<T>> }) {
  const controls = useAnimation();
  const [internalIsHovered, setInternalIsHovered] = React.useState(false);

  const isHovered = externalIsHovered !== undefined ? externalIsHovered : internalIsHovered;

  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isHovered) {
      controls.start('animate');
      interval = setInterval(async () => {
        await controls.start('initial');
        controls.start('animate');
      }, 1500);
    } else {
      controls.start('initial');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isHovered, controls]);

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (externalIsHovered === undefined) {
        setInternalIsHovered(true);
      }
      // @ts-ignore
      onMouseEnter?.(e);
      onHover?.();
    },
    [onMouseEnter, onHover, externalIsHovered]
  );

  const handleMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (externalIsHovered === undefined) {
        setInternalIsHovered(false);
      }
      // @ts-ignore
      onMouseLeave?.(e);
    },
    [onMouseLeave, externalIsHovered]
  );

  return (
    <AnimateIconContext.Provider value={{ controls, isHovered }}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
        style={{ display: 'inline-flex', cursor: 'pointer', ...(props.style as React.CSSProperties) }}
      >
        <Icon variant={variant} size={size} {...props} />
      </div>
    </AnimateIconContext.Provider>
  );
}
