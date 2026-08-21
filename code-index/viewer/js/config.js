// Module set varies per repo (read from graph.json at load time), so colors
// are assigned dynamically instead of hardcoded per project. Labels fall
// back to the raw module id — same convention as LAYOUT.md.
const MODULE_PALETTE = [
  '#5aa9ff', '#7ee08a', '#f0c674', '#d96c6c', '#b48ead',
  '#4fd6c8', '#e08ac0', '#a3c46a', '#e0a45a', '#7a8bd6',
];

const MODULE_LABEL = {};
const _moduleColors = {};

// Call once after graph.json loads, before any colorFor()/legend/label use.
// Sorting module ids first keeps the color assignment stable regardless of
// object/array iteration order.
function initModuleColors(modules) {
  modules
    .map(m => m.id)
    .sort()
    .forEach((id, i) => {
      _moduleColors[id] = MODULE_PALETTE[i % MODULE_PALETTE.length];
    });
}

function colorFor(module) {
  return _moduleColors[module] || '#888';
}
