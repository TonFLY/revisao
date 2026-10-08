const CourseSync=(()=>{
  let profile='',key='',baseline={},chain=Promise.resolve(),ready=false;
  const normalized=v=>({done:v?.done===true,fav:v?.fav===true,notes:typeof v?.notes==='string'?v.notes:''});
  const status=s=>{$('#syncStatus').textContent=s};
  const local=()=>{if(key)localStorage.setItem(key,JSON.stringify({state,baseline}))};
  const dirty=()=>Object.keys(state).filter(id=>allItems().some(x=>x.id===id)&&JSON.stringify(normalized(state[id]))!==JSON.stringify(normalized(baseline[id])));
  async function request(options={}){
    const r=await fetch('/api/courses?uid='+encodeURIComponent(profile),{...options,headers:{'Content-Type':'application/json'},cache:'no-store'});
    if(!r.ok)throw Error('Falha na sincronização');return r.json();
  }
  function persist(){
    local();
    if(!ready){status('Somente neste navegador; sincronização pendente.');return}
    chain=chain.catch(()=>{}).then(async()=>{
      const ids=dirty();if(!ids.length)return;
      status('Sincronizando…');
      try{
        for(let i=0;i<ids.length;i+=25){
          const items=ids.slice(i,i+25).map(id=>({id,...normalized(state[id])}));
          await request({method:'POST',body:JSON.stringify({items})});
          for(const x of items)baseline[x.id]=normalized(x);
          local();
        }
        status(dirty().length?'Há alterações pendentes.':'Sincronizado no SQL Server.');
      }catch{status('Falha ao sincronizar. Cópia local mantida. Clique aqui para tentar novamente.')}
    });
  }
  async function init(message){
    if(profile)return;
    profile=message.profile;key='review_courses_v2_'+profile;
    try{const previous=localStorage.getItem(key);const saved=JSON.parse(previous||localStorage.getItem('review_courses_v1_'+profile)||'{}');state=saved.state||{};baseline=previous?saved.baseline||{}:{}}catch{state={};baseline={}}
    $('#profileName').textContent='Perfil: '+message.profile;
    $('#syncStatus').onclick=()=>{if(ready)persist();else loadRemote()};
    render();await loadRemote();
  }
  async function loadRemote(){
    status('Carregando seu progresso…');
    try{
      const r=await request();const pending=Object.keys(state).filter(id=>JSON.stringify(normalized(state[id]))!==JSON.stringify(normalized(baseline[id])));const cache=state;baseline={};
      for(const x of r.items)baseline[x.id]={done:x.completed===true||x.completed===1,fav:x.favorite===true||x.favorite===1,notes:x.notes||''};
      state={...baseline};for(const id of pending)state[id]=cache[id];
      ready=true;local();render();status('Sincronizado no SQL Server.');persist();
    }catch{ready=false;status('Progresso local; banco indisponível. Clique para tentar novamente.')}
  }
  window.addEventListener('message',async e=>{
    if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='course-profile'||typeof e.data.profile!=='string')return;
    await init(e.data);
  });
  parent.postMessage({type:'course-ready'},location.origin);
  window.addEventListener('beforeunload',local);
  return {persist,local};
})();
