// access vocabulary is extractor-defined (code-index/extractor/CONTRACT.md)
// and differs per language (C#: public/private/protected: TS top-level:
// exported/module-private). Substring-match on "private"/"protected" -
// same convention generate_layouts.py uses - instead of a fixed per-
// language class list, so any extractor's real values render sensibly.
function accessClass(access) {
  const a = (access || '').toLowerCase();
  if (a.includes('private')) return 'access-private';
  if (a.includes('protected')) return 'access-protected';
  return 'access-public';
}

function showDetail(node) {
  const el = document.getElementById('detail');
  el.style.display = 'block';
  if (node.type === 'module') {
    const incoming = state.data.moduleEdges.filter(e => e.target === node.id);
    const outgoing = state.data.moduleEdges.filter(e => e.source === node.id);
    el.innerHTML = `
      <h2>${MODULE_LABEL[node.id] || node.id}</h2>
      <div class="path">${node.fileCount} files, ${node.symbolCount} symbols</div>
      <div style="margin-top:8px;color:#c5cdd6;">Outgoing</div>
      ${outgoing.map(e => `<div>${e.target} <span style="color:#7d8690">(${e.weight})</span></div>`).join('') || '<div style="color:#7d8690">none</div>'}
      <div style="margin-top:6px;color:#c5cdd6;">Incoming</div>
      ${incoming.map(e => `<div>${e.source} <span style="color:#7d8690">(${e.weight})</span></div>`).join('') || '<div style="color:#7d8690">none</div>'}
    `;
  } else {
    const symbols = state.data.symbols
      .filter(s => s.fileId === node.id)
      .sort((a, b) => a.line - b.line);
    el.innerHTML = `
      <h2>${node.name}</h2>
      <div class="path">${node.path}</div>
      <div style="color:#7d8690;margin-top:4px;">
        ${MODULE_LABEL[node.module] || node.module} - in:${node.inDegree} out:${node.outDegree} - ${symbols.length} symbols
      </div>
      <div class="sym">
        ${symbols.map(s => `
          <div class="kind">${s.kind}</div>
          <div class="name ${accessClass(s.access)}">${s.name}${s.scope ? ` <span style="color:#7d8690">in ${s.scope}</span>` : ''}<span style="color:#5a6470"> :${s.line}</span></div>
        `).join('')}
      </div>
    `;
  }
}
