const $=s=>document.querySelector(s);let file=null,url=null,clips=[];
const input=$("#file"),vid=$("#vid");$("#pick").onclick=()=>input.click();$("#change").onclick=()=>input.click();
input.onchange=e=>e.target.files[0]&&load(e.target.files[0]);
["dragover","drop"].forEach(x=>$("#drop").addEventListener(x,e=>e.preventDefault()));
$("#drop").ondrop=e=>{let f=e.dataTransfer.files[0];if(f)load(f)};
function load(f){if(!f.type.startsWith("video/"))return alert("Pilih file video.");file=f;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);vid.src=url;$("#name").textContent=f.name;vid.onloadedmetadata=()=>$("#meta").textContent=`${fmt(vid.duration)} · ${mb(f.size)} · ${vid.videoWidth}×${vid.videoHeight}`;$("#drop").classList.add("hide");$("#work").classList.remove("hide");$("#results").classList.add("hide")}
function fmt(s){let h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);return h?`${h}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`:`${m}:${String(x).padStart(2,"0")}`}
function mb(n){return (n/1048576).toFixed(1)+" MB"}
function starts(d,n,l,mode){let max=Math.max(0,d-l);if(max<=0)return[0];if(mode==="start")return Array.from({length:n},(_,i)=>Math.min(i*l,max));if(mode==="random")return Array.from({length:n},()=>Math.random()*max).sort((a,b)=>a-b);return n===1?[max/2]:Array.from({length:n},(_,i)=>max*i/(n-1))}
function mime(){
  return [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ].find(x=>MediaRecorder.isTypeSupported(x))||""
}
function wait(t){return new Promise(r=>setTimeout(r,t))}
async function recordClip(start,len,index){
  const stream=vid.captureStream?vid.captureStream():vid.mozCaptureStream?.();
  if(!stream)throw Error("Browser ini belum mendukung captureStream. Gunakan Chrome Android terbaru.");
  const type=mime();if(!type)throw Error("Browser tidak mendukung perekaman WebM.");

  // Bitrate lebih masuk akal untuk menjaga detail & gerakan tetap halus,
  // tanpa memakai FFmpeg/WASM yang berat.
  const pixels=(vid.videoWidth||720)*(vid.videoHeight||1280);
  const bitrate=pixels>=2073600?5500000:pixels>=921600?4000000:2500000;
  const rec=new MediaRecorder(stream,{
    mimeType:type,
    videoBitsPerSecond:bitrate,
    audioBitsPerSecond:128000
  });

  let chunks=[];
  rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);

  vid.pause();
  vid.playbackRate=1;
  const target=Math.min(start,Math.max(0,vid.duration-.05));
  vid.currentTime=target;
  await new Promise((resolve,reject)=>{
    const ok=()=>{vid.removeEventListener("seeked",ok);resolve()};
    vid.addEventListener("seeked",ok,{once:true});
    setTimeout(()=>{vid.removeEventListener("seeked",ok);resolve()},1000);
  });

  await new Promise(async(resolve,reject)=>{
    let done=false;
    const finish=()=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      try{vid.pause();rec.stop()}catch(e){}
      resolve();
    };
    const timer=setTimeout(finish,(len+0.35)*1000);

    rec.onerror=()=>{clearTimeout(timer);if(!done){done=true;reject(rec.error||Error("Recorder error"))}};
    const end=start+len;

    // requestVideoFrameCallback gives frame-based timing when supported,
    // so the clip ends on an actual decoded frame instead of waiting for
    // the coarser timeupdate event.
    const check=()=>{
      if(done)return;
      if(vid.currentTime>=end){finish();return}
      if("requestVideoFrameCallback" in HTMLVideoElement.prototype){
        vid.requestVideoFrameCallback(check);
      }else{
        setTimeout(check,30);
      }
    };

    rec.start(100);
    try{
      await vid.play();
      check();
    }catch(e){
      clearTimeout(timer);
      if(!done){done=true;try{rec.stop()}catch(_){};reject(e)}
    }
  });

  await wait(120);
  return new Blob(chunks,{type});
}
function setp(p,s){$("#bar").style.width=p+"%";$("#pct").textContent=Math.round(p)+"%";$("#label").textContent=s}
function dl(c){let a=document.createElement("a");a.href=c.url;a.download=c.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
$("#go").onclick=async()=>{if(!file)return;let btn=$("#go");btn.disabled=true;$("#prog").classList.remove("hide");$("#results").classList.add("hide");$("#cards").innerHTML="";clips=[];try{let n=Math.max(1,Math.min(10,+$("#count").value||5)),len=Math.min( +$("#dur").value,vid.duration),ss=starts(vid.duration,n,len,$("#mode").value);for(let i=0;i<ss.length;i++){setp(i/ss.length*95,`Merekam clip ${i+1} dari ${ss.length}…`);let b=await recordClip(ss[i],len,i);let c={blob:b,url:URL.createObjectURL(b),name:`clip_${String(i+1).padStart(2,"0")}.webm`,start:ss[i],len};clips.push(c);card(c,i)}setp(100,"Selesai");$("#results").classList.remove("hide");$("#results").scrollIntoView({behavior:"smooth"});}catch(e){console.error(e);alert("Gagal: "+e.message)}finally{btn.disabled=false}};
function card(c,i){let d=document.createElement("div");d.className="card";d.innerHTML=`<video controls playsinline></video><div><b>CLIP ${String(i+1).padStart(2,"0")}</b><small>${fmt(c.start)} → ${fmt(c.start+c.len)} · WebM</small><button class="download">DOWNLOAD</button></div>`;d.querySelector("video").src=c.url;d.querySelector("button").onclick=()=>dl(c);$("#cards").appendChild(d)}
$("#all").onclick=()=>clips.forEach((c,i)=>setTimeout(()=>dl(c),i*500));