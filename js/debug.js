function listAttributes(pre,x) {
  message('// ------------- listing attributes for '+pre);
  for (var a in x.attributes) {
    message(pre+a+" = "+x.getAttribute(a));
    if (a && a.value)
      message("// "+pre+a+".value : "+a.value);
  }
}

function listProperties(pre,x) {
  message('// ----start---- listing properties for '+pre);
  for (var key in x) {
    p = x[key];
    if (p && (typeof p != "function"))
      message(pre+'.'+key+"("+typeof p+") : "+p);
    if (p && p.value)
      message("// "+pre+'.'+key+".value : "+p.value);
  }
  message('// ----end------ listing properties for '+pre);
}

function message(msg) {
  msgs = document.getElementById('messages');
  msgs.appendChild(document.createTextNode(msg));
  msgs.appendChild(document.createElement("br"));
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


