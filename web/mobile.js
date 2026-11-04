const notice=document.getElementById("notice");
if(sessionStorage.getItem("sakina-notice-x"))notice.hidden=true;
document.getElementById("notice-x").addEventListener("click",()=>{notice.hidden=true;sessionStorage.setItem("sakina-notice-x","1")});
const vids=[...document.querySelectorAll("video")];
for(const v of vids)v.addEventListener("play",()=>{for(const o of vids)if(o!==v&&!o.paused)o.pause()});
