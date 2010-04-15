
// use document element 'messages' as an output console
function message(msg,div) {
  var msgs = document.getElementById(div==null?'messages':div);
  msgs.appendChild(document.createTextNode(msg));
  msgs.appendChild(document.createElement("br"));
}
function messagePre(msg,div) {
  var msgs = document.getElementById(div==null?'messages':div);
  var pre  = document.createElement('pre');
  pre.appendChild(document.createTextNode(msg));
  msgs.appendChild(pre);
}

// wrap object methods, for debugging purposes, with optional before code;
function wrap(x,f,advice) {
  var wrapper = function(oldf) {
    return function() { 
      var args = [];
      for(var i=0; i<arguments.length; i++) args.push(arguments[i]);
      // message('calling '+f+'('+args.join(',')+')'); 
      if (advice.before) advice.before.apply(this,arguments);
      if (advice.around) {
        args.unshift(oldf);
        var result = advice.around.apply(this,args);
      } else
        var result = oldf.apply(this,arguments); 
      if (advice.after) advice.after.apply(this,arguments);
      return result;
      };
    };

  if ((f in x) && ((typeof x[f])==='function')) {
    var oldf = x[f]
    x[f] = wrapper(oldf);
    message('wrapped '+f); // +' = '+oldf);
  } else
    message('wrap('+x+','+f+') failed: '+x.hasOwnProperty(f)+' '+x[f]+' '+(f in x)+' '+(typeof x[f]));
}

// TODO: marginally useful so far, needs elaboration
function listProperties(pre,x,without) {
  message('// ----start---- listing properties for '+pre);
  for (var key in x) {
    p = x[key];
    if (p!==null && p!=='' 
        && (without!==null || (without.indexOf(typeof p)===-1))) {
      message(pre+'.'+key+"("+typeof p+") : "+p);
      if (p.name)
        message("// "+pre+'.'+key+".name : "+p.name);
      if (p.value)
        message("// "+pre+'.'+key+".value : "+p.value);
    }
  }
  message('// ----end------ listing properties for '+pre);
}

// TODO: - use querySelector
//       - support resize/hide
function ObjectViewer(consoleID) {
  var console = document.getElementById(consoleID);

  var form = document.createElement('form');
  var show = document.createElement('input');
  show.type = 'submit'; show.value = 'show';
  var clear = document.createElement('input');
  clear.type = 'submit'; clear.value = 'clear';
  var commandline = document.createElement('input');
  commandline.type = 'text'; commandline.maxlength = '100';
  commandline.style.width = '80%';
  document.body.insertBefore(form,document.body.firstChild);

  form.appendChild(commandline);
  form.appendChild(show);
  form.appendChild(clear);
  form.action = '#';
  show.addEventListener('click',function(event) {
      message(commandline.value,consoleID);
      var node = eval(commandline.value);
      for (var p in node) {
        message(commandline.value+'.'+p+': '+node[p],consoleID);
      }
    },false);
  clear.addEventListener('click',function(event) {
        while (console.hasChildNodes())
          console.removeChild(console.firstChild);
    },false);
}

function JSEval(consoleID) {
  var console = document.getElementById(consoleID);

  var form = document.createElement('form');
  var button = document.createElement('input');
  button.type = 'submit'; button.value = 'eval';
  var commandline = document.createElement('input');
  commandline.type = 'text'; commandline.maxlength = '100';
  commandline.style.width = '80%';
  document.body.insertBefore(form,document.body.firstChild);

  form.appendChild(commandline);
  form.appendChild(button);
  form.action = '#';
  button.addEventListener('click',function(event) {
      message(commandline.value,consoleID);
      try { var result = ' = '+eval(commandline.value); } 
      catch (e) { var result = ' ! '+e; };
      message(result,consoleID);
    },false);
}

function listXML(prefix,xml) {
  var text = [];
  if (xml.nodeType===3) // just a text node
    text = [prefix+xml.textContent];
  else {
    var tag      = '<'+xml.nodeName;
    var attrs    = xml.attributes;
    if (attrs)
      for (var i=0; i<attrs.length; i++)
        tag += ' '+attrs.item(i).nodeName+'='+attrs.item(i).nodeValue;
    if (xml.hasChildNodes && xml.hasChildNodes()) {
      text = [prefix+tag+'>'];
      for (var i=0; i<xml.childNodes.length; i++)
        text = text.concat(listXML(prefix+' ',xml.childNodes.item(i)));
      text.push(prefix+'</'+xml.nodeName+'>');
    } else
      text = [prefix+tag+'/>'];
  }
  return text;
}
