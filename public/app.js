const steps=['Сканирование сайта','Поиск изображений','Проверка доступности','Расчёт хешей','Поиск дубликатов','Анализ метаданных','Расчёт риска','Формирование отчёта'];
const form=document.getElementById('auditForm');
const progress=document.getElementById('progress');
const results=document.getElementById('results');
const stepsBox=document.getElementById('steps');
const percent=document.getElementById('progressPercent');

function renderSteps(active=-1){
  stepsBox.innerHTML=steps.map((name,i)=>{
    const done=i<active, current=i===active;
    return '<div class="step '+(current?'active ':'')+(done?'done':'')+'"><span class="num">0'+(i+1)+'</span><span>'+name+'</span><span class="state">'+(done?'✓':current?'●':'○')+'</span></div>';
  }).join('');
}

form.addEventListener('submit',async e=>{
  e.preventDefault();
  const url=document.getElementById('url').value.trim();
  document.getElementById('auditUrl').textContent=url;
  progress.classList.remove('hidden');
  results.classList.add('hidden');
  renderSteps(0);
  progress.scrollIntoView({behavior:'smooth'});

  // Пока API ещё не подключён: показываем реалистичный прототип процесса.
  for(let i=0;i<steps.length;i++){
    renderSteps(i);
    percent.textContent=Math.round((i/steps.length)*100)+'%';
    await new Promise(r=>setTimeout(r,450));
  }
  percent.textContent='100%';
  renderSteps(steps.length);

  // Демонстрационные значения. Следующим шагом заменяются ответом /api/audit.
  document.getElementById('imagesCount').textContent='—';
  document.getElementById('uniqueCount').textContent='—';
  document.getElementById('duplicatesCount').textContent='—';
  document.getElementById('metadataCount').textContent='—';
  ['low','medium','high','critical'].forEach(id=>document.getElementById(id).textContent='—');
  results.classList.remove('hidden');
  results.scrollIntoView({behavior:'smooth'});
});

const dialog=document.getElementById('feedbackDialog');
document.getElementById('feedbackBtn').onclick=()=>dialog.showModal();
document.querySelector('.close').onclick=()=>dialog.close();
document.getElementById('sendFeedback').onclick=()=>{
  const text=document.getElementById('feedbackText').value.trim();
  if(!text){alert('Напишите сообщение.');return}
  const email=document.getElementById('feedbackEmail').value.trim();
  window.location.href='mailto:?subject=Image Audit — обратная связь&body='+encodeURIComponent(text+(email?'\n\nEmail: '+email:''));
};