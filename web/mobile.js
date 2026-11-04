const vids=[...document.querySelectorAll("video")];
for(const v of vids)v.addEventListener("play",()=>{for(const o of vids)if(o!==v&&!o.paused)o.pause()});
