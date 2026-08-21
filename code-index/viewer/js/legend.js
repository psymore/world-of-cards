function renderLegend(data) {
  const el = document.getElementById('legend');
  el.innerHTML = '';
  data.modules.forEach(m => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = colorFor(m.id);
    const lab = document.createElement('div');
    lab.textContent = `${MODULE_LABEL[m.id] || m.id} (${m.fileCount}f / ${m.symbolCount}s)`;
    el.appendChild(sw);
    el.appendChild(lab);
  });
}
