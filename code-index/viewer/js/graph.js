const Graph = ForceGraph3D()(document.getElementById('graph'))
  .backgroundColor('#0b0d10')
  .nodeOpacity(0.95)
  .linkOpacity(0.4)
  .linkDirectionalParticles(0)
  .nodeLabel(n => n.type === 'module'
    ? `<b>${MODULE_LABEL[n.id] || n.id}</b><br/>${n.fileCount} files - ${n.symbolCount} symbols`
    : `${n.path}<br/>${n.symbolCount} symbols - in:${n.inDegree} out:${n.outDegree}`);

function rebuild() {
  const { data, showFiles, showFileEdges, search } = state;
  if (!data) return;

  const moduleNodes = data.modules.map(m => ({
    ...m,
    color: colorFor(m.id),
    val: Math.max(20, m.fileCount * 0.6),
  }));

  const term = search.trim().toLowerCase();
  let fileNodes = [];
  if (showFiles) {
    fileNodes = data.files
      .filter(f => !term
        || f.path.toLowerCase().includes(term)
        || f.name.toLowerCase().includes(term))
      .map(f => ({
        ...f,
        color: colorFor(f.module),
        val: Math.max(1, f.symbolCount * 0.15),
      }));
  }

  const nodes = [...moduleNodes, ...fileNodes];
  const nodeIds = new Set(nodes.map(n => n.id));

  const links = [];
  data.moduleEdges.forEach(e => {
    links.push({
      source: e.source,
      target: e.target,
      color: '#5a6470',
      width: Math.max(1, Math.log2(e.weight)),
      kind: 'module',
      weight: e.weight,
    });
  });

  if (showFiles) {
    fileNodes.forEach(f => {
      links.push({
        source: f.module,
        target: f.id,
        color: colorFor(f.module),
        width: 0.3,
        kind: 'membership',
      });
    });
  }

  if (showFiles && showFileEdges) {
    data.fileEdges.forEach(e => {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
        links.push({
          source: e.source,
          target: e.target,
          color: '#3a4048',
          width: 0.2,
          kind: 'file',
        });
      }
    });
  }

  Graph.nodeVal(n => Math.max(state.nodeSize, (n.val || 1) * state.nodeSize / 6))
       .linkWidth(l => l.width)
       .linkColor(l => l.color);

  Graph.d3Force('link').distance(l => l.kind === 'module' ? state.linkDist * 1.6 : state.linkDist);
  Graph.d3Force('charge').strength(-state.linkDist * 2);

  Graph.graphData({ nodes, links });
}

Graph.onNodeClick(node => {
  state.selected = node;
  showDetail(node);
  const distance = 200;
  const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
  Graph.cameraPosition(
    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
    node,
    1200
  );
});
