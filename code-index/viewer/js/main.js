fetch('graph.json').then(r => r.json()).then(data => {
  state.data = data;
  initModuleColors(data.modules);
  document.getElementById('stats').textContent =
    `${data.stats.moduleCount} modules - ${data.stats.fileCount} files - ${data.stats.symbolCount} symbols - ${data.stats.fileEdgeCount} file edges`;
  renderLegend(data);
  rebuild();
});

document.getElementById('showFiles').addEventListener('change', e => {
  state.showFiles = e.target.checked;
  rebuild();
});
document.getElementById('showFileEdges').addEventListener('change', e => {
  state.showFileEdges = e.target.checked;
  rebuild();
});
document.getElementById('nodeSize').addEventListener('input', e => {
  state.nodeSize = parseInt(e.target.value, 10);
  rebuild();
});
document.getElementById('linkDist').addEventListener('input', e => {
  state.linkDist = parseInt(e.target.value, 10);
  rebuild();
});
document.getElementById('search').addEventListener('input', e => {
  state.search = e.target.value;
  rebuild();
});
document.getElementById('resetView').addEventListener('click', () => {
  Graph.zoomToFit(800, 60);
});
document.getElementById('clearSelection').addEventListener('click', () => {
  state.selected = null;
  document.getElementById('detail').style.display = 'none';
});
