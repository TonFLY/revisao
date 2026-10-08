const CourseBridge=(()=>{
  let frame;
  function send(){
    if(!frame||!currentUid)return;
    const key='review_course_token_'+currentUid;
    let token=localStorage.getItem(key);
    if(!/^[a-f0-9]{64}$/.test(token||'')){const bytes=crypto.getRandomValues(new Uint8Array(32));token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(key,token)}
    frame.contentWindow.postMessage({type:'course-profile',profile:currentUid,token},location.origin);
  }
  window.addEventListener('message',e=>{if(e.origin===location.origin&&frame&&e.source===frame.contentWindow&&e.data?.type==='course-ready')send()});
  function enter(){
    if(!currentUid)return;
    const container=document.getElementById('coursesContainer');
    if(frame)return;
    frame=document.createElement('iframe');frame.src='/courses.html';frame.title='Cursos SQL';frame.allow='fullscreen';frame.style.cssText='width:100%;height:calc(100vh - 170px);min-height:650px;border:0';frame.onload=send;container.replaceChildren(frame);
  }
  function leave(){if(frame){frame.remove();frame=null}}
  return {enter,leave};
})();
