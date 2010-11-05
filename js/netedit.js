// Petri net editor, simple module loader
// 
// TODO: move to require.js for dependency resolution/loading

(function () {
  function loadModule(mod) {
    var element = document.createElement('script');
    element.setAttribute('type','text/javascript');
    element.setAttribute('src',mod);
    document.getElementsByTagName('head')[0].appendChild(element);
  }
  loadModule("debug.js");
  loadModule("utils.js");
  loadModule("vector.js");
  loadModule("net-elements.js");
  loadModule("net.js");
  loadModule("net-import-export.js");
})()

