// modules.js
//
// simplistic module system with module loader, as described in
// http://libraryinstitute.wordpress.com/2010/12/01/loading-javascript-modules/
//
(function () {

  var modules = {}; // private record of module data

  // don't log if there's no console
  function log(msg) {
    if (typeof console!=="undefined")
      console.log(msg);
  }

  // modules are functions with additional information
  function module(name,imports,mod) {

    // record module information
    log('found module '+name);
    modules[name] = {name:name, imports: imports, mod: mod};
    
    // trigger loading of import dependencies
    for (var imp in imports) loadModule(imports[imp]);
    
    // check whether this was the last module to be loaded
    // in a given dependency group
    loadedModule(name);
  }

  // trigger module loading by adding script element
  function loadModule(mod) {

    if (modules[mod])
      return;             // don't load the same module twice
    else
      modules[mod] = {};  // mark module as currently loading

    // add a script element to document head, with module as src
    var element = document.createElement('script');
    element.setAttribute('type','text/javascript');
    element.setAttribute('src',mod);
    document.getElementsByTagName('head')[0].appendChild(element);
    
    // no longer keep record of loading order
    // order.push(mod);
    
  }

  // check whether this was the last module to be loaded
  // in a given dependency group;
  // if yes, start linking and running modules
  function loadedModule(mod) {
    log('finished loading: '+mod);

    // collect modules marked as currently loading
    var pending=[];
    for (var m in modules)
      if (!modules[m].name) pending.push(m);

    // if no more modules need to be loaded, we can start 
    // linking the modules together
    if (pending.length===0) {
      log('all done loading');
      linkModules();
    } else {
      log('loads pending: '+pending.join(', '));
    }
  }

  // Sort modules by dependencies (dependents last),
  // returning sorted list of module names.
  function dependency_sort(modules) {

    var pending = [],   // modules remaining to be sorted
        sorted = [],    // modules already sorted
        been_here = {}; // remember length of pending list for each module 
                        // (if we revisit a module without pending
                        //  getting any shorter, we are stuck in a loop)

    // preparation: linked modules do not need to be sorted,
    //              all others go into pending
    for (var name in modules)
      if (modules[name].linked)
        sorted.push(name);  // allready linked by a previous run
      else
        pending.push(name); // sort for linking (after its dependencies)

    // has mod been sorted already?
    function issorted(mod){
      var result = false;
      for (var s in sorted) result = result || (sorted[s]===mod);
      return result;
    }

    // have all dependencies deps been sorted already?
    function aresorted(deps){
      var result = true;
      for (var d in deps) result = result && (issorted(deps[d]));
      return result;
    }

    // repeat while there are modules pending
    while (pending.length>0) {

      // consider the next pending module
      var m = pending.shift();

      // if we've been here and have not made any progress, we are looping
      // (no support for cyclic module dependencies)
      if (been_here[m] && been_here[m]<=pending.length)
        throw("can't sort dependencies: "+sorted+" < "+m+" < "+pending);
      else
        been_here[m] = pending.length;

      // consider the current module's import dependencies
      var deps = modules[m].imports;
      if (aresorted(deps))
        sorted.push(m);  // dependencies done; module done
      else
        pending.push(m); // some dependencies still pending;
                         // revisit module later
    }

    return sorted;
  }

  // link and run loaded modules, keep record of results
  function linkModules() {
    log('linking modules');
    
    // sort modules in dependency order
    var sortedNames = dependency_sort(modules);

    // link modules in dependency order
    for (var nextName in sortedNames) {
      var name    = sortedNames[nextName];
    
      var module  = modules[name];
      var imports = module.imports;

      if (module.linked) {
        log('already linked '+name);
        continue;
      } 
      log('linking module '+name);

      // collect import dependencies
      var deps = []; 
      for (var i in imports)
        deps.push(modules[imports[i]].linked);

      // execute module code, pass imports, record exports
      modules[name].linked = module.mod.apply(null,deps);
    }
  }

  // export module wrapper
  window.module = module;

  // just calling linkModules here would not work, as we have only 
  // added the script elements, the scripts could still be loading;

  // calling linkModules in document onload would not work
  // in browsers which do not stop parsing while script-inserted
  // external scripts are loading;

  // therefore, we call linkModules when all modules in a dependency
  // group have been loaded, as checked by loadedModule;

})()

