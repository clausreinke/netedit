// simple module loader
//
// provides a module construct, module loading and linking
// 
// TODO: rename to modules.js

(function (window) {

var modules = []; // private record of module data

/**
 * first step toward modules, a module has a name (should be
 * the module's file name), a list of imports (module file names),
 * and a function from imports to exports; the module get called/run
 * in the loading phase, via loadModule; we simply record the module 
 * data, and trigger loading of not-yet-known dependencies.
 * 
 * @param imports
 * @param mod
 */
function module(name,imports,mod) {
  window.console.log('loading module '+name);
  modules[name] = {name:name, imports: imports, mod: mod};
  for (var imp in imports) loadModule(imports[imp]);
}

// TODO: could load other resources the same way, adding CSS dependencies
//        to the head, perhaps providing other files as string contents?
/**
 * initiate loading a module by adding a script node with the module as
 * source. modules should use module(name,imports,module_function) as above.
 * 
 * @param mod
 */
function loadModule(mod) {
  if (modules[mod])
    return;
  else
    modules[mod] = {};
  var element = document.createElement('script');
  element.setAttribute('type','text/javascript');
  element.setAttribute('src',mod);
  document.getElementsByTagName('head')[0].appendChild(element);
}

/**
 * Sort modules by dependencies (dependents last), returning
 * sorted list of module names.
 * 
 * @param modules
 */
function dependency_sort(modules) {
  var pending = [], sorted = [], been_here = {};
  for (var name in modules) pending.push(name);
  while (pending.length>0) {
    var m    = pending.shift();
    if (been_here[m] && been_here[m]<=pending.length)
      throw("can't sort dependencies: "+sorted+" < "+m+" < "+pending);
    else
      been_here[m] = pending.length;
    var deps = modules[m].imports;
    if (deps.every(function(e){return sorted.indexOf(e)!==-1;}))
      sorted.push(m);
    else
      pending.push(m);
  }
  return sorted;
}


/**
 * assuming that the modules have been loaded/recorded in dependency
 * order, we can link and instantiate them by calling each module's
 * module function with linked variants of its imports; we do not
 * just export all the module's exports to window - to selectively
 * import and use the linked modules, just write an inline module).
 */
function linkModules() {
  window.console.log('linking modules');

  var sortedNames   = dependency_sort(modules);

  for (var nextName in sortedNames) {
    var name    = sortedNames[nextName];
    var module  = modules[name];
    var imports = module.imports;
    window.console.log('linking module '+name
                      +', importing '+(imports.length>0?imports.join(','):'nothing'));
    var imps = []; for (var imp in imports) imps.push(modules[imports[imp]].linked);
    modules[name].linked = module.mod.apply(null,imps);
  }
}

/**
 * Concatenate modules in dependency order, skipping excluded modules. If you
 * store the result in a file, you can pre-load all modules from there, avoiding
 * separate script loads. This could be combined with packing and compression.
 *
 * @param excluded
 */
function packageModules(excluded) {
  window.console.log('packaging modules');

  var packaged      = "",
      sortedNames   = dependency_sort(modules);

  for (var nextName in sortedNames) {
    var name    = sortedNames[nextName];
    if (excluded.indexOf(name)!=-1) continue;
    var module  = modules[name];
    var imports = module.imports;
    window.console.log('packaging module '+name
                      +', importing '+(imports.length>0?imports.join(','):'nothing'));
    var imps = []; for (var imp in imports) imps.push(modules[imports[imp]].linked);
    packaged += "module('"+name+"',["
                       +imports.map(function(e){return "'"+e+"'"}).join(",")+"],"
                       +module.mod+");";
  }

  return packaged;
}

// export only the module and packageModules functions (to load modules, just
// write an inline module with those modules as dependencies); implicitly
// call linkModules after all modules are ready (this also means that all
// modules need to be in the head)
window.module         = module;
window.packageModules = packageModules;
window.addEventListener('load',linkModules,false);

  // calling linkModules here wouldn't work, as loadModule only adds the
  // script element that initiates the download, asynchronously!
  // instead call linkModules in body.onload.

})(window);

