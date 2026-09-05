import { debounce } from "lodash-es";
import React, {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/utils";

// ref https://github.com/magicuidesign/magicui/blob/main/registry/magicui/marquee.tsx
// modified from MagicUI Marquee component.
//
// 采用“双副本轨道”实现：轨道内放置两份相同内容，整体位移一份内容宽度后，
// 循环复位时画面与前一帧完全一致，避免周期性跳变。
// 滚动由 Web Animations API 驱动：hover 暂停/恢复通过 pause()/play() 完成，
// 不会像切换 CSS animation-play-state 那样出现跳变或变速。

// 滚动的固定线速度 (px/s)：滚动快慢不随内容长度改变，
// 单圈时长 = 位移量 / 速度，内容越长单圈耗时越久。
const MARQUEE_SPEED = 30;

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Optional CSS class name to apply custom styles
   */
  className?: string;
  /**
   * Whether to reverse the animation direction
   * @default false
   */
  reverse?: boolean;
  /**
   * Whether to pause the animation on hover
   * @default false
   */
  pauseOnHover?: boolean;
  /**
   * Content to be displayed in the marquee
   */
  children: React.ReactNode;
  /**
   * Whether to animate vertically instead of horizontally
   * @default false
   */
  vertical?: boolean;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  ...props
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const hoveredRef = useRef(false);
  const [animate, setAnimate] = useState(false);
  const [translate, setTranslate] = useState(0);
  // 内容指纹：文本变化时自增，使轨道携带新 key 重挂载。
  // 规避部分 Linux WebView 在 transform 动画节点上原地换文字时，
  // 合成图层仍缓存旧字形、导致新旧文字在同一帧重叠。
  const lastTextRef = useRef<string | null>(null);
  const [contentKey, setContentKey] = useState(0);

  // 观察容器尺寸与内容变化：
  // - 内容超宽(高)时启用滚动；只在阈值跨越时切换状态，避免动画被反复重置；
  // - 记录当前"一份内容 + gap"的位移量，内容尺寸变化时重建动画，避免拼缝错位；
  // - 文本变化时重建轨道（contentKey 变化 → 轨道重挂载 → 新合成图层）。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const group = groupRef.current;
      const track = trackRef.current;
      if (!group || !track) return;
      const contentSize = vertical ? group.offsetHeight : group.offsetWidth;
      const viewSize = vertical
        ? container.offsetHeight
        : container.offsetWidth;
      const nextAnimate = contentSize > viewSize + 1;
      if (nextAnimate) {
        const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
        const nextTranslate = Math.round(contentSize + gap);
        setTranslate((prev) => (prev === nextTranslate ? prev : nextTranslate));
      }
      setAnimate((prev) => (prev === nextAnimate ? prev : nextAnimate));
    };

    // 防抖包装，避免 ResizeObserver 反复回调导致抖动
    const refresh = debounce(() => {
      const text = groupRef.current?.textContent ?? "";
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        setContentKey((key) => key + 1);
      }
      measure();
    }, 120);

    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(refresh);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    lastTextRef.current = groupRef.current?.textContent ?? "";
    measure();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      refresh.cancel();
    };
  }, [vertical]);

  // 创建 / 取消 Web Animations API 滚动动画
  useEffect(() => {
    if (!animate) return;

    const track = trackRef.current;
    if (!track) return;

    const transformEnd = `${vertical ? "translateY" : "translateX"}(${-translate}px)`;
    // 时长随单圈位移量变化，保持恒定的滚动线速度
    const duration = Math.round((translate / MARQUEE_SPEED) * 1000);
    const animation = track.animate(
      reverse
        ? [{ transform: transformEnd }, { transform: "none" }]
        : [{ transform: "none" }, { transform: transformEnd }],
      {
        duration,
        iterations: Infinity,
        easing: "linear",
      },
    );
    animationRef.current = animation;
    if (hoveredRef.current) {
      animation.pause();
    }

    return () => {
      animationRef.current = null;
      animation.cancel();
    };
  }, [animate, reverse, vertical, translate, contentKey]);

  const handleMouseEnter = useCallback(() => {
    hoveredRef.current = true;
    animationRef.current?.pause();
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = false;
    animationRef.current?.play();
  }, []);

  const hoverProps: {
    ref?: RefObject<HTMLDivElement | null>;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  } = pauseOnHover
    ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
    : {};

  const containerProps = { ...props, ...hoverProps };

  const groupClasses = cn(
    "flex shrink-0 [&_*]:shrink-0",
    vertical ? "flex-col" : "flex-row",
  );

  return (
    <div
      ref={containerRef}
      {...containerProps}
      className={cn(
        "flex w-full overflow-hidden [--gap:1rem]",
        vertical ? "flex-col" : "flex-row",
        className,
      )}>
      {/* 轨道结构恒定，groupA 始终作为首个子节点（ref/测量稳定）；
          是否滚动仅通过增删第二份副本与 WAAPI 动画来控制。
          key 随内容文本变化而变，触发轨道重挂载（重建合成图层） */}
      <div
        key={contentKey}
        ref={trackRef}
        className={cn(
          "flex shrink-0 gap-(--gap)",
          vertical ? "flex-col" : "flex-row",
        )}
        style={
          { willChange: animate ? "transform" : undefined } as CSSProperties
        }>
        <div ref={groupRef} className={groupClasses}>
          {children}
        </div>
        {animate && (
          <div aria-hidden className={groupClasses}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
