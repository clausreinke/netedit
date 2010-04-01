
// use document element 'messages' as an output console
function message(msg) {
  msgs = document.getElementById('messages');
  msgs.appendChild(document.createTextNode(msg));
  msgs.appendChild(document.createElement("br"));
}

// wrap object methods, for debugging purposes, with optional before code;
// examples:
//
//  // just report calls to obj.method, with arguments
//  wrap(obj.prototype,'method'); 
//  // report calls to obj.method, with arguments, 
//  // and output more specific info about arguments
//  wrap(obj.prototype,'method',function(arg1,arg2) { message(..); });
function wrap(x,f,before) {
  var wrapper = function(oldf) {
    return function() { 
      var args = '';
      for(var i=0; i<arguments.length; i++) args += ','+arguments[i];
      message('calling '+f+'('+args.substring(1)+')'); 
      if (before) before.apply(this,arguments);
      return oldf.apply(this,arguments); };
    };

  if ((f in x) && ((typeof x[f])==='function')) {
    var oldf = x[f]
    x[f] = wrapper(oldf);
    message('wrapped '+f); // +' = '+oldf);
  } else
    message('wrap('+x+','+f+') failed: '+x.hasOwnProperty(f)+' '+x[f]+' '+(f in x)+' '+(typeof x[f]));
}

// TODO: marginally useful so far, needs elaboration
function listProperties(pre,x) {
  message('// ----start---- listing properties for '+pre);
  for (var key in x) {
    p = x[key];
    if (p!==null && p!=='' && (typeof p != "function")) {
      message(pre+'.'+key+"("+typeof p+") : "+p);
      if (p.name)
        message("// "+pre+'.'+key+".name : "+p.name);
      if (p.value)
        message("// "+pre+'.'+key+".value : "+p.value);
    }
  }
  message('// ----end------ listing properties for '+pre);
}

// ------------ miscellaneous experiments

function listAttributes(pre,x,ns) {
  message('// ------------- listing attributes for '+pre);
  for (var a in x.attributes) {
    var xa = x.attributes[a];
    if (xa && xa.name && xa.value)
    message(pre+'.'+a+" = "+x.getAttribute(a)
                     +' | '+x.getAttributeNS(ns,a)
                     +' | '+xa.name+'='+xa.value);
    if (a && a.value)
      message("// "+pre+a+".value : "+a.value);
  }
}

function listSVG(id) {
  var svg     = document.getElementById(id);
  var console = document.getElementById('console');
  console.appendChild(document.createTextNode('listing svg "'+id+'"'));
  console.appendChild(document.createElement("br"));
  for (var c in svg.children) {
    child = svg.children[c];
    if (typeof child != "function") {
      cls = child.className ? child.className.baseVal : 'none';
      console.appendChild(document.createTextNode(c+" "+child+" - "+cls));
      console.appendChild(document.createElement("br"));
    }
  }
}

