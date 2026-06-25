import { createContext, useContext, useRef, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/utils/cn";

interface MouseContext {
  mouseX: number;
  mouseY: number;
}

const MouseContext = createContext<MouseContext>({ mouseX: 0, mouseY: 0 });

export function CardContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ mouseX: 0, mouseY: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseRef.current = { mouseX: x, mouseY: y };
  };

  const handleMouseEnter = () => {};

  const handleMouseLeave = () => {
    mouseRef.current = { mouseX: 0, mouseY: 0 };
  };

  return (
    <MouseContext.Provider value={mouseRef.current}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn("flex items-center justify-center", className)}
      >
        {children}
      </div>
    </MouseContext.Provider>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mouseX, mouseY } = useContext(MouseContext);

  const style: CSSProperties = {
    transformStyle: "preserve-3d",
    transition: "all 0.1s ease",
  };

  if (mouseX !== 0 || mouseY !== 0) {
    const rotateY = ((mouseX - 240) / 240) * 15;
    const rotateX = ((mouseY - 180) / 180) * -15;
    style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  }

  return (
    <div ref={ref} className={cn("", className)} style={style}>
      {children}
    </div>
  );
}

export function CardItem({
  children,
  className,
  translateZ,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  translateZ?: number | string;
  as?: any;
  [key: string]: any;
}) {
  const style: CSSProperties = {};
  if (translateZ !== undefined) {
    style.transform = `translateZ(${translateZ}px)`;
    style.transformStyle = "preserve-3d";
  }

  return (
    <Tag className={cn("", className)} style={style} {...rest}>
      {children}
    </Tag>
  );
}
