
// use document element 'messages' as an output console
function message(msg,div) {
  msgs = document.getElementById(div==null?'messages':div);
  msgs.appendChild(document.createTextNode(msg));
  msgs.appendChild(document.createElement("br"));
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

