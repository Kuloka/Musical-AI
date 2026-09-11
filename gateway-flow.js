(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MultiMindGatewayFlow = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const DEFAULTS = Object.freeze({
    paths: 64,
    speed: 1,
    lineOpacity: 0.16,
    particleOpacity: 0.72,
    lineWidth: 1,
    particleSize: 2.2,
    focusX: 0.5,
    focusY: 0.42,
    clickRadius: 110,
    clickForce: 72,
    focusEase: 0.09
  });

  function createGatewayFlow(canvas, options) {
    if (!canvas || !canvas.getContext) return { destroy() {} };
    const config = Object.assign({}, DEFAULTS, options || {});
    const context = canvas.getContext('2d');
    if (!context) return { destroy() {} };
    const paths = Array.from({ length: Math.max(12, Math.round(config.paths)) }, function (_, index) {
      return {
        side: index % 2,
        lane: index / Math.max(1, config.paths - 1),
        phase: Math.random(),
        speed: 0.00125 + Math.random() * 0.0018
      };
    });
    const bursts = [];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 1, height = 1, frame = 0, observer, clickElement, visibleFocus;
    canvas.dataset.gatewayFlow = 'active';
    canvas.dataset.gatewayInteractive = 'false';

    function resolveTarget(value) {
      return typeof value === 'function' ? value() : value;
    }
    function focusPoint() {
      const rect = canvas.getBoundingClientRect();
      const fallback = { x: width * config.focusX, y: height * config.focusY };
      const center = (value, axis) => {
        const target = resolveTarget(value);
        if (!target || !target.getBoundingClientRect) return fallback[axis];
        const box = target.getBoundingClientRect();
        if (!box.width || !box.height || box.bottom < rect.top || box.top > rect.bottom || box.right < rect.left || box.left > rect.right) return fallback[axis];
        return axis === 'x' ? box.left + box.width / 2 - rect.left : box.top + box.height / 2 - rect.top;
      };
      return {
        x: center(config.focusXTarget || config.focusTarget, 'x'),
        y: center(config.focusYTarget || config.focusTarget, 'y')
      };
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function bezier(t, a, b, c, d) {
      const u = 1 - t;
      return {
        x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
        y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y
      };
    }
    function burst(event) {
      const rect = canvas.getBoundingClientRect();
      bursts.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, radius: 0, life: 1 });
    }
    function bindClickTarget() {
      const next = resolveTarget(config.interactiveTarget);
      if (clickElement === next) return;
      if (clickElement) clickElement.removeEventListener('click', burst);
      clickElement = next;
      if (clickElement) clickElement.addEventListener('click', burst);
      canvas.dataset.gatewayInteractive = clickElement ? 'true' : 'false';
    }
    function draw(time) {
      bindClickTarget();
      context.clearRect(0, 0, width, height);
      if (!document.hidden) {
        const targetFocus = focusPoint();
        if (!visibleFocus) visibleFocus = { ...targetFocus };
        const ease = reduceMotion.matches ? 1 : Math.min(1, Math.max(0.01, config.focusEase));
        visibleFocus.x += (targetFocus.x - visibleFocus.x) * ease;
        visibleFocus.y += (targetFocus.y - visibleFocus.y) * ease;
        const focus = visibleFocus;
        const color = getComputedStyle(canvas).color || 'rgb(210, 210, 210)';
        bursts.forEach(function (item) {
          item.radius += 12;
          item.life -= 0.018;
        });
        for (let index = bursts.length - 1; index >= 0; index -= 1) {
          if (bursts[index].life <= 0) bursts.splice(index, 1);
        }
        paths.forEach(function (path) {
          const spread = height * 1.28;
          const startY = path.lane * spread - height * 0.14;
          const start = { x: path.side ? width + 30 : -30, y: startY };
          const bend1 = { x: path.side ? width * 0.76 : width * 0.24, y: startY };
          const bend2 = { x: path.side ? focus.x + width * 0.13 : focus.x - width * 0.13, y: focus.y };
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.bezierCurveTo(bend1.x, bend1.y, bend2.x, bend2.y, focus.x, focus.y);
          context.strokeStyle = color;
          context.globalAlpha = config.lineOpacity;
          context.lineWidth = config.lineWidth;
          context.setLineDash([1, 5]);
          context.stroke();
          context.setLineDash([]);
          if (!reduceMotion.matches) {
            path.phase += path.speed * config.speed;
            if (path.phase > 1) path.phase -= 1;
          }
          const position = bezier(path.phase, start, bend1, bend2, focus);
          bursts.forEach(function (item) {
            const dx = position.x - item.x;
            const dy = position.y - item.y;
            const distance = Math.hypot(dx, dy) || 1;
            const edge = Math.abs(distance - item.radius);
            if (edge < config.clickRadius) {
              const force = (1 - edge / config.clickRadius) * item.life * config.clickForce;
              position.x += dx / distance * force;
              position.y += dy / distance * force;
            }
          });
          context.globalAlpha = config.particleOpacity;
          context.fillStyle = color;
          context.fillRect(position.x - config.particleSize / 2, position.y - config.particleSize / 2, config.particleSize, config.particleSize);
        });
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    }

    resize();
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    } else {
      addEventListener('resize', resize);
    }
    frame = requestAnimationFrame(draw);
    return {
      refresh() { resize(); bindClickTarget(); },
      focusPoint,
      visibleFocusPoint() { return visibleFocus ? { ...visibleFocus } : focusPoint(); },
      burstAt(x, y) { bursts.push({ x, y, radius: 0, life: 1 }); },
      destroy() {
        cancelAnimationFrame(frame);
        observer && observer.disconnect();
        if (!observer) removeEventListener('resize', resize);
        if (clickElement) clickElement.removeEventListener('click', burst);
        delete canvas.dataset.gatewayFlow;
        delete canvas.dataset.gatewayInteractive;
      }
    };
  }

  return { DEFAULTS, createGatewayFlow };
});
