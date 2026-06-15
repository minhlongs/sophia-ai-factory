# Advanced Framer Motion Effects Research

## 1. Hero Section Animations

### Animated Gradient Backgrounds
Create fluid, living backgrounds using keyframe animations on background gradients.
```tsx
<motion.div
  animate={{
    background: [
      "linear-gradient(45deg, #ff0080, #7928ca)",
      "linear-gradient(45deg, #7928ca, #ff0080)"
    ]
  }}
  transition={{ duration: 5, repeat: Infinity, repeatType: "reverse" }}
/>
```

### 3D Floating Cards
Use `useMouseMove` or `useScroll` mapped to rotation values for depth.
```tsx
const x = useMotionValue(0);
const y = useMotionValue(0);
const rotateX = useTransform(y, [0, 100], [10, -10]);
const rotateY = useTransform(x, [0, 100], [-10, 10]);
```

### Typing Animations
Simulate typing for headlines using staggered character variants.
```tsx
const sentence = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};
const letter = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 }
};
```

## 2. Scroll-Triggered Animations

### Reveal & Stagger
Use `whileInView` for effortless scroll triggering.
```tsx
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, margin: "-100px" }}
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
  {items.map(item => <motion.li variants={fadeInUp} />)}
</motion.div>
```

### Parallax Effects
Bind element Y position to scroll progress for depth.
```tsx
const { scrollYProgress } = useScroll();
const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
<motion.div style={{ y }} />
```

## 3. Micro-Interactions

### Glow & Scale on Hover
Subtle scale with shadow bloom.
```tsx
<motion.button
  whileHover={{
    scale: 1.05,
    boxShadow: "0 0 20px rgba(121, 40, 202, 0.5)"
  }}
  whileTap={{ scale: 0.95 }}
/>
```

### Number Counting
Animate numeric values using `animate` from 0 to target.
```tsx
function Counter({ from, to }) {
  const nodeRef = useRef();
  useEffect(() => {
    const controls = animate(from, to, {
      duration: 1,
      onUpdate(value) {
        nodeRef.current.textContent = value.toFixed(0);
      }
    });
    return () => controls.stop();
  }, [from, to]);
  return <span ref={nodeRef} />;
}
```

## 4. Premium Card Effects

### Shine/Sheen Effect
Animate a gradient overlay across the card.
```tsx
<motion.div
  initial={{ x: "-100%" }}
  whileHover={{ x: "100%" }}
  transition={{ duration: 0.5 }}
  style={{
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)"
  }}
/>
```

### Holographic Borders
Use `motion.div` as a border container with a rotating conical gradient.
```tsx
<motion.div
  animate={{ rotate: 360 }}
  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
  style={{ background: "conic-gradient(from 0deg, #ff0080, #7928ca, #ff0080)" }}
/>
```

## 5. Performance Best Practices

- **Layout Thrashing**: Avoid animating `width`, `height`, `top`, `left`. Use `transform` (`x`, `y`, `scale`) and `opacity`.
- **layout Prop**: Use sparingly; it triggers layout calculations. Perfect for reordering lists but heavy for simple moves.
- **LazyMotion**: Reduce bundle size by loading features on demand.
  ```tsx
  <LazyMotion features={domAnimation}>
    <m.div animate={{ x: 100 }} />
  </LazyMotion>
  ```
- **will-change**: Use `style={{ willChange: "transform" }}` for complex animations to hint the browser.
- **Reduced Motion**: Respect user preferences.
  ```tsx
  const shouldReduceMotion = useReducedMotion();
  const variants = {
    visible: { opacity: 1, x: shouldReduceMotion ? 0 : 100 }
  };
  ```

## Libraries Recommended
- **Framer Motion**: Core library.
- **tsparticles**: For lightweight particle effects.
- **react-spring**: For physics-based alternative (often overkill if using Framer).

## Unresolved Questions
- Specific performance budget for the target landing page?
- Are there specific brand colors for the holographic effects?
