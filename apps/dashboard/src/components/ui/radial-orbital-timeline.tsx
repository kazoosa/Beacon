import { useState, useEffect, useRef } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
}

/**
 * PERFORMANCE-TUNED orbital timeline.
 * Original: setInterval at 50ms forever = constant re-renders even when tab
 * was off-screen. This version:
 *   - Uses requestAnimationFrame instead of setInterval.
 *   - Pauses rotation entirely when any node is expanded or user hovers.
 *   - Stops when scrolled out of view (IntersectionObserver).
 *   - Slows rotation to 0.1°/frame from 0.3° so it feels ambient, not dizzy.
 *   - Numbers each node (1–5) so the flow order is obvious regardless of
 *     current rotation position.
 */
export default function RadialOrbitalTimeline({ timelineData }: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [inView, setInView] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Pause rotation when out of viewport — no wasted raf when user isn't
  // looking at it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (autoRotate && inView) {
        // 0.1° / 16ms ≈ full rotation every 60s
        setRotationAngle((prev) => (prev + (dt / 16) * 0.1) % 360);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, inView]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState: Record<number, boolean> = {};
      newState[id] = !prev[id];
      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);
        const nodeIndex = timelineData.findIndex((item) => item.id === id);
        const targetAngle = (nodeIndex / timelineData.length) * 360;
        setRotationAngle(270 - targetAngle);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return newState;
    });
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.5, Math.min(1, 0.5 + 0.5 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, angle, zIndex, opacity };
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":   return "text-white bg-black border-white";
      case "in-progress": return "text-black bg-white border-black";
      case "pending":     return "text-white bg-black/40 border-white/50";
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseEnter={() => setAutoRotate(false)}
      onMouseLeave={() => { if (!activeNodeId) setAutoRotate(true); }}
      className="w-full h-[600px] flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden relative"
    >
      <div className="absolute top-6 left-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
        Beacon flow · hover to pause · click a node to expand
      </div>

      <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
        <div ref={orbitRef} className="absolute w-full h-full flex items-center justify-center" style={{ perspective: "1000px" }}>
          <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 flex items-center justify-center z-10">
            <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md" />
          </div>
          <div className="absolute w-[400px] h-[400px] rounded-full border border-white/10" />
          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                ref={(el) => { nodeRefs.current[item.id] = el; }}
                className="absolute transition-opacity duration-500 cursor-pointer"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isExpanded ? 200 : position.zIndex,
                  opacity: isExpanded ? 1 : position.opacity,
                  willChange: "transform",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isExpanded
                      ? "bg-white text-black border-white shadow-lg shadow-white/30 scale-125"
                      : isRelated
                      ? "bg-white/50 text-black border-white"
                      : "bg-black text-white border-white/40 hover:border-white"
                  } ${isPulsing && !isExpanded ? "ring-2 ring-white/50" : ""}`}
                >
                  <Icon size={16} />
                </div>
                {/* Explicit step number so order is never ambiguous */}
                <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                  isExpanded ? "bg-black text-white border-white" : "bg-white text-black border-black"
                }`}>
                  {item.id}
                </div>
                <div className={`absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tracking-wider transition-all duration-300 ${
                  isExpanded ? "text-white scale-110" : "text-white/70"
                }`}>
                  {item.title}
                </div>

                {isExpanded && (
                  <Card className="absolute top-24 left-1/2 -translate-x-1/2 w-64 bg-black/90 backdrop-blur-lg border-white/30 shadow-xl text-white">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <Badge className={`px-2 text-[10px] ${getStatusStyles(item.status)}`}>
                          Step {item.id}
                        </Badge>
                        <span className="text-xs font-mono text-white/50">{item.date}</span>
                      </div>
                      <CardTitle className="text-sm mt-2">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-white/80">
                      <p>{item.content}</p>
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="flex items-center">
                            <Zap size={10} className="mr-1" />
                            Progress
                          </span>
                          <span className="font-mono">{item.energy}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-400" style={{ width: `${item.energy}%` }} />
                        </div>
                      </div>
                      {item.relatedIds.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                          <div className="text-[10px] uppercase tracking-wider font-medium text-white/70 mb-2">Next / Previous</div>
                          <div className="flex flex-wrap gap-1">
                            {item.relatedIds.map((relId) => {
                              const relItem = timelineData.find((i) => i.id === relId);
                              return (
                                <Button
                                  key={relId}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center h-6 px-2 py-0 text-xs rounded border-white/20 bg-transparent hover:bg-white/10 text-white/80 hover:text-white"
                                  onClick={(e) => { e.stopPropagation(); toggleItem(relId); }}
                                >
                                  {relItem?.title}
                                  <ArrowRight size={8} className="ml-1 text-white/60" />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
