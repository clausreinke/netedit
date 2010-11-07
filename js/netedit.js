// Petri net editor, simple module loader
// 
// TODO: move to require.js for dependency resolution/loading

/**
 * first step toward modules, a module has a name (should be
 * the module's file name), a list of imports (module file names),
 * and a function from imports to exports; in the loading phase,
 * we simply record the module data.
 * 
 * @param imports
 * @param mod
 */
var modules = [];
function module(name,imports,mod) {
  window.console.log('loading module '+name);
  modules[name] = {name:name, imports: imports, mod: mod};
}

// TODO: - don't rely on dependency order, sort
/**
 * assuming that the modules have been loaded/recorded in dependency
 * order, we can link and instantiate them by calling each module's
 * module function with linked variants of its imports, then exporting
 * the module's exports to window.
 */
function linkModules() {
  window.console.log('linking modules');
  var linkedModules = [];
  for (var name in modules) {
    var module  = modules[name];
    var imports = module.imports;
    window.console.log('linking module '+name+', importing '+imports.join(','));
    var imps = []; for (var imp in imports) imps.push(modules[imports[imp]].linked);
    modules[name].linked = module.mod.apply(null,imps);
    linkedModules[name] = modules[name].linked;
  }
  return linkedModules
}

(function () {
  /**
   * initiate loading a module by adding a script node with the module as
   * source. modules should use module(name,imports,module_function) as above.
   * 
   * @param mod
   */
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
  // calling linkModules here wouldn't work, as loadModule only adds the
  // script element that initiates the download, asynchronously!
  // instead call linkModules in body.onload.
})()

