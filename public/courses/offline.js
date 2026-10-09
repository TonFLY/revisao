window.CourseOffline=(()=>{
  let selected=false,files=new Map(),urls=[],generation=0;
  const norm=s=>s.replace(/\\/g,'/').normalize('NFC').toLowerCase();
  const release=()=>{generation++;document.querySelectorAll('#detailbody video').forEach(v=>{v.pause();v.removeAttribute('src');v.load()});urls.forEach(URL.revokeObjectURL);urls=[]};
  function find(item){const file=files.get(norm(item.relativePath||''));return file&&file.size===item.size?file:null}
  function play(item){
    if(!selected)return;
    const iframe=document.querySelector('#detailbody iframe');if(!iframe)return;
    const file=find(item),ticket=generation;
    if(!file){iframe.replaceWith(Object.assign(document.createElement('p'),{textContent:'Arquivo local não encontrado: '+item.relativePath+'. Confira a pasta selecionada. O link do Drive continua disponível quando houver internet.'}));return}
    const video=document.createElement('video');video.controls=true;video.preload='metadata';video.style.cssText='width:100%;max-height:60vh;background:#000';video.setAttribute('playsinline','');
    const url=URL.createObjectURL(file);urls.push(url);video.src=url;video.onerror=()=>{if(ticket===generation){const p=document.createElement('p');p.textContent='Não foi possível ler ou reproduzir este arquivo. Confirme que está disponível offline no Windows e que o formato é compatível com o navegador.';video.after(p)}};iframe.replaceWith(video);
  }
  document.querySelector('#localFolder').onchange=e=>{
    files=new Map();for(const f of e.target.files){const path=f.webkitRelativePath.split('/').slice(1).join('/');const key=norm(path);if(files.has(key))files.set(key,null);else files.set(key,f)}
    selected=e.target.files.length>0;
    const lessons=allModules.flatMap(m=>m.lessons),materials=allModules.flatMap(m=>[...m.materials,...m.lessons.flatMap(l=>l.materials)]);
    const matched=x=>{const f=find(x);return f&&f.size===x.size};
    document.querySelector('#localStatus').textContent=selected?`${lessons.filter(matched).length}/${lessons.length} aulas e ${materials.filter(matched).length}/${materials.length} materiais encontrados com tamanho esperado. A leitura dos vídeos ainda precisa ser verificada. Arquivos sem correspondência não são associados por suposição.`:'Nenhuma pasta selecionada.';
    if(activeLesson){release();showLesson(activeLesson)}
  };
  document.querySelector('#detailbody').addEventListener('click',e=>{
    const a=e.target.closest('[data-material]');if(!a||!selected)return;
    e.preventDefault();const items=allModules.flatMap(m=>[...m.materials,...m.references,...m.lessons.flatMap(l=>l.materials)]);const item=items.find(x=>x.id===a.dataset.material),file=item&&find(item);
    if(!file){alert('Material não encontrado na pasta local. Confira o download e a pasta selecionada.');return}
    const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=item.title;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
  const form=document.querySelector('#offlineProfile');
  if(window===parent){form.hidden=false;const name=localStorage.getItem('review_courses_last_profile')||'';document.querySelector('#offlineName').value=name;if(name)CourseSync.init({profile:name})}
  form.onsubmit=e=>{e.preventDefault();const name=document.querySelector('#offlineName').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,50);if(!name){alert('Informe um nome com letras ou números.');return}const previous=localStorage.getItem('review_courses_last_profile');if(previous&&previous!==name){localStorage.setItem('review_courses_last_profile',name);location.reload()}else CourseSync.init({profile:name})};
  document.querySelector('#offlineLink').target='_blank';
  document.querySelector('#prepareOffline').onclick=async()=>{
    const status=document.querySelector('#offlineStatus');status.textContent='Preparando…';
    try{if(!('serviceWorker' in navigator))throw Error();await navigator.serviceWorker.register('/courses-offline-sw.js');const reg=await navigator.serviceWorker.ready;const worker=reg.active;await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>reject(Error()),30000);channel.port1.onmessage=e=>{clearTimeout(timer);e.data.ok?resolve():reject(Error())};worker.postMessage({type:'prepare-courses'},[channel.port2])});status.textContent='Página preparada. Salve o link da página offline nos favoritos e abra-o neste mesmo navegador. Selecione a pasta novamente ao reabrir. Progresso fica local e sincroniza quando a conexão voltar.'}catch{status.textContent='Não foi possível preparar a página. Verifique a conexão e tente novamente no Chrome ou Edge.'}
  };
  return {play,release};
})();
