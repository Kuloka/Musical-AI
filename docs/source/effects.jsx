import { Component, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import GatewayFlow from '../../gateway-flow.js';
import './BorderGlow.css';
import './effects.css';

// BorderGlow's edge-proximity and directional cone, adapted for existing HTML.
// Keep the original elements so tabs, links and native details retain behavior.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function enhanceCards(){document.querySelectorAll('.feature-grid article,.detail-grid article,.download-grid article,.product-window,.demo,.faq details,.demo-tabs button,.button').forEach(card => {
  if(card.classList.contains('border-glow-card'))return;
  card.classList.add('border-glow-card');
  const edge = document.createElement('span');
  edge.className = 'edge-light';
  edge.setAttribute('aria-hidden','true');
  card.append(edge);
  card.addEventListener('pointermove', e => {
    if(reduced.matches || e.pointerType === 'touch') return;
    const {left,top,width,height} = card.getBoundingClientRect();
    const dx=e.clientX-left-width/2, dy=e.clientY-top-height/2;
    const proximity=Math.min(1,Math.max(Math.abs(dx)/(width/2),Math.abs(dy)/(height/2)));
    card.style.setProperty('--edge-proximity',String(proximity*100));
    card.style.setProperty('--cursor-angle',`${Math.atan2(dy,dx)*180/Math.PI+90}deg`);
  },{passive:true});
  card.addEventListener('pointerleave',()=>card.style.setProperty('--edge-proximity','0'));
});}
enhanceCards();
document.addEventListener('site:render',enhanceCards);

class QuietFallback extends Component {
  state={failed:false};
  static getDerivedStateFromError(){ return {failed:true}; }
  render(){return this.state.failed ? null : this.props.children;}
}
function Background(){
  const canvas=useRef(null);
  useEffect(()=>{
    const flow=GatewayFlow.createGatewayFlow(canvas.current,{
      paths:matchMedia('(max-width: 600px)').matches?42:72,
      speed:.82,
      lineOpacity:.14,
      particleOpacity:.72,
      particleSize:2.4,
      focusTarget:()=>document.querySelector('.hero h1'),
      interactiveTarget:()=>document.querySelector('.hero h1'),
      focusY:.3
    });
    return ()=>flow.destroy();
  },[]);
  return <canvas ref={canvas}/>;
}
const layer=document.createElement('div');
layer.id='gateway-flow';layer.setAttribute('aria-hidden','true');
document.body.prepend(layer);
createRoot(layer).render(<QuietFallback><Background/></QuietFallback>);
