const overlayCss = `
.progress-overlay-root {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  background: rgba(248, 253, 254, 0.18);
  overflow: hidden;

}

.progress-overlay-root::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.24) 45%,
      transparent 72%
    );
  transform: translateX(-100%);
  animation-name: progress-overlay-sheen;
  animation-duration: 1450ms;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@keyframes progress-overlay-sheen {
  0% { transform: translateX(-100%); opacity: 0; }
  22% { opacity: 0.5; }
  100% { transform: translateX(100%); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .progress-overlay-root::after {
    animation: none;
    opacity: 0;
  }
}
`;

export function ProgressOverlay() {
  return (
    <>
      <style>{overlayCss}</style>
      <div data-testid="progress-overlay" className="progress-overlay-root" />
    </>
  );
}
