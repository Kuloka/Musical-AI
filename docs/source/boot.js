// Enhance the already usable static page after its initial load has finished.
// Failed or stalled JavaScript must never hide the English content/downloads.
(() => {
  function load(src,done){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    fetch(src,{signal:controller.signal}).then(response=>{
      if(!response.ok)throw Error('Asset HTTP '+response.status);
      return response.text();
    }).then(source=>{
      const script=document.createElement('script');script.textContent=source;
      document.head.appendChild(script);done?.();
    }).catch(()=>{}).finally(()=>clearTimeout(timeout));
  }
  window.addEventListener('load',()=>{
    load('site-core.js?v=1.20');
    const effects=()=>load('effects.js?v=1.20');
    if('requestIdleCallback' in window)requestIdleCallback(effects,{timeout:2000});else setTimeout(effects,300);
  },{once:true});
})();
