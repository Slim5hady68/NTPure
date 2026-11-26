'use strict';
(() => {
const KEY='ntp-am-wallpaper-v1';
const fileInput=document.getElementById('wallpaper-file');
const remove=document.getElementById('remove-wallpaper');
const controls=document.getElementById('wallpaper-controls');
const slider=document.getElementById('wallpaper-darkness');
const output=document.getElementById('wallpaper-percent');
const status=document.getElementById('wallpaper-status');
let state={image:'',darkness:35};
try {const stored=JSON.parse(localStorage.getItem(KEY));if(stored && typeof stored==='object')state={image:typeof stored.image==='string'?stored.image:'',darkness:Number.isFinite(Number(stored.darkness))?Math.max(0,Math.min(90,Number(stored.darkness))):35};}catch{}
const update=()=>{controls.hidden=!state.image;slider.value=String(state.darkness);output.textContent=state.darkness+'%';};
function persist() {try {if(state.image)localStorage.setItem(KEY,JSON.stringify(state));else localStorage.removeItem(KEY);window.parent.postMessage({type:'ntpam-wallpaper-updated'},location.origin);status.textContent='Background saved.';return true;}catch{status.textContent='Not enough browser storage. Try a smaller wallpaper or export a backup.';return false;}}
// Preserve original image bytes when storage permits; resize larger images only if needed.
fileInput.addEventListener('change',async()=>{
 const file=fileInput.files?.[0];
 if(!file){status.textContent='No image selected.';return;}
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
  status.textContent='Choose a JPG, PNG or WebP image.';return;
 }
 status.textContent='Reading original photo without canvas…';
 try{
  const data=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(new Error('Could not read selected photo.'));
   reader.readAsDataURL(file);
  });
  if(typeof data!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(data))throw Error('Invalid image data.');
  // Check decoding in an actual image element before touching saved storage.
  const dimensions=await new Promise((resolve,reject)=>{
   const test=new Image();
   test.onload=()=>resolve([test.naturalWidth,test.naturalHeight]);
   test.onerror=()=>reject(new Error('The original photo could not be displayed.'));
   test.src=data;
  });
  if(!dimensions[0]||!dimensions[1])throw Error('Photo has no visible dimensions.');
  const previous=state.image;
  state.image=data;
  if(!persist()){
   state.image=previous;
   // Larger originals may exceed browser storage. Resize only when necessary.
   const photo=new Image();
   await new Promise((resolve,reject)=>{photo.onload=resolve;photo.onerror=reject;photo.src=data;});
   for(const max of [1920,1280,960,640]){
    const ratio=Math.min(1,max/Math.max(photo.naturalWidth,photo.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(photo.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(photo.naturalHeight*ratio));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Image resizing is unavailable. Try a smaller photo.');
    ctx.drawImage(photo,0,0,canvas.width,canvas.height);
    const resized=canvas.toDataURL('image/jpeg',0.85);
    if(!resized.startsWith('data:image/jpeg;base64,'))throw Error('Image resizing is unavailable. Try a smaller photo.');
    state.image=resized;
    if(persist()){update();status.textContent='Wallpaper saved ('+canvas.width+' × '+canvas.height+').';return;}
    state.image=previous;
   }
   return;
  }
  update();
  status.textContent='Wallpaper saved ('+dimensions.join(' × ')+').';
 }catch(e){status.textContent='Upload failed: '+(e?.message||'Unable to read this photo.');}
});
remove.addEventListener('click' ,()=>{state.image='';persist();update();});
slider.addEventListener('input',()=>{state.darkness=Number(slider.value);output.textContent=state.darkness+'%';window.parent.postMessage({type:'ntpure-wallpaper-dim',value:state.darkness},location.origin);});
slider.addEventListener('change',()=>{state.darkness=Number(slider.value);persist();});
update();
})();
