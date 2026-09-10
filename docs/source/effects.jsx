import { Component, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Antigravity from './Antigravity';
import './BorderGlow.css';
import './effects.css';

// BorderGlow's edge-proximity and directional cone, adapted for existing HTML.
// Keep the original elements so tabs, links and native details retain behavior.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.feature-grid article,.detail-grid article,.product-window,.demo,.faq details,.demo-tabs button,.button').forEach(card => {
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
});

class QuietFallback extends Component {
  state={failed:false};
  static getDerivedStateFromError(){ return {failed:true}; }
  render(){return this.state.failed ? null : this.props.children;}
}
function Background(){
  const [quiet,setQuiet]=useState(reduced.matches);
  const [visible,setVisible]=useState(!document.hidden);
  useEffect(()=>{
    const motion=()=>setQuiet(reduced.matches), visibility=()=>setVisible(!document.hidden);
    reduced.addEventListener('change',motion);
    document.addEventListener('visibilitychange',visibility);
    return ()=>{reduced.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  if(quiet)return null;
  return <Antigravity count={matchMedia('(max-width: 600px)').matches?130:300} magnetRadius={6} ringRadius={7} waveSpeed={0.4} waveAmplitude={1} particleSize={1.5} lerpSpeed={0.05} color="#fdfdff" autoAnimate particleVariance={1} paused={!visible}/>;
}
const layer=document.createElement('div');
layer.id='antigravity';layer.setAttribute('aria-hidden','true');
document.body.prepend(layer);
createRoot(layer).render(<QuietFallback><Background/></QuietFallback>);
