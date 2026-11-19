const toast = document.getElementById('toast');
let toastTimer;
function showToast(message){
  toast.textContent=message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),1800);
}
document.querySelectorAll('.player').forEach(player=>{
  player.addEventListener('click',()=>showToast(`${player.dataset.player}：プロフィール画面はこれから実装します`));
});
document.querySelectorAll('.bottom-nav button').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));
    button.classList.add('active');
    showToast(`${button.dataset.page} は今後実装予定です`);
  });
});
document.getElementById('menuBtn').addEventListener('click',()=>showToast('メニューは今後追加します'));
