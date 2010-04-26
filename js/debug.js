
//
// Debug-related utilities
//
// logging messages to div elements, listing object/node attributes and
// properties, JS read-eval-print loop, listing XML trees, wrapping functions;
//
// listing XML trees and wrapping functions (allowing a form of aspect-oriented
// programming) would be of more general use, so might move away from here,
// perhaps to utils.js, or to its own file;
//
// most stuff here is experimental, much is built-in/predefined in good JS
// debuggers or frameworks, but I find it useful to define these myself, both to
// improve my understanding and to gain more flexibility/scriptability
//

// logging messages to div element {{{
/**
 * use document element div (default 'messages') as a simple output console for
 * message msg
 * 
 * @param msg
 * @param div
 */
function message(msg,div) {
  var msgs = document.getElementById(div==null?'messages':div);
  msgs.appendChild(document.createTextNode(msg));
  msgs.appendChild(document.createElement("br"));
}
/**
 * use document element div (default 'messages') as a console for formatted output msg
 * 
 * @param msg
 * @param div
 */
function messagePre(msg,div) {
  var msgs = document.getElementById(div==null?'messages':div);
  var pre  = document.createElement('pre');
  pre.appendChild(document.createTextNode(msg));
  msgs.appendChild(pre);
}
// }}}

/**
 * wrap object x method f with before/after/around advice, for
 * debugging/tracing, general aspect-oriented programming, ..
 * 
 * @param x
 * @param f
 * @param advice
 */
function wrap(x,f,advice) { // {{{
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
} // }}}

// TODO: marginally useful so far, needs elaboration
/**
 * list object/node x properties, optional filter; pre should be name of x;
 * 
 * @param pre
 * @param x
 * @param filter
 * @param nofunctions
 */
function listProperties(pre,x,filter,nofunctions) { // {{{
  message('// ----start---- listing attributes for '+pre);
  if (x.attributes)
    for (var i=0; i<x.attributes.length; i++)
      message(x.attributes.item(i).nodeName+'="'+x.attributes.item(i).nodeValue+'"');
  message('// ------------- listing properties for '+pre);
  for (var key in x) {
    p = x[key];
    if (p!==null && p!=='' 
        && (filter==null || key.match(filter))
        && (!nofunctions || (typeof p!=="function"))) {
      message(pre+'.'+key+"("+typeof p+") : "+p);
    }
  }
  message('// ----end------ listing properties for '+pre);
} // }}}

// TODO: - use querySelector
//       - support interactive resize/hide
/**
 * simplistic object/dom listing to consoleID (creates its own 'show'/'clear' buttons)
 * 
 * @param consoleID
 */
function ObjectViewer(consoleID) { // {{{
  var console = document.getElementById(consoleID);

  var form = document.createElement('form');
  var show = document.createElement('input');
  show.type = 'submit'; show.value = 'show';
  var clear = document.createElement('input');
  clear.type = 'submit'; clear.value = 'clear';
  var commandline = document.createElement('input');
  commandline.type = 'text'; commandline.maxlength = '100';
  commandline.style.width = '80%';
  document.body.insertBefore(form,console);

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
} // }}}

/**
 * interactively evaluate javascript code (creates its own input field
 * and 'eval' button, logs results/errors to consoleID)
 * 
 * @param consoleID
 */
function JSEval(consoleID) { // {{{
  var console = document.getElementById(consoleID);

  var form = document.createElement('form');
  var button = document.createElement('input');
  button.type = 'submit'; button.value = 'eval';
  var commandline = document.createElement('input');
  commandline.type = 'text'; commandline.maxlength = '100';
  commandline.style.width = '80%';
  document.body.insertBefore(form,console);

  form.appendChild(commandline);
  form.appendChild(button);
  form.action = '#';
  button.addEventListener('click',function(event) {
      message(commandline.value,consoleID);
      try { var result = ' = '+eval(commandline.value); } 
      catch (e) { var result = ' ! '+e; };
      message(result,consoleID);
    },false);
} // }}}

// TODO: - should we use a less explicit/pre-defined method for this?
//       - move to utils?
/**
 * formatted XML listing of DOM tree xml; returns list of lines;
 * typical use: messagePre(listXML('',xml).join("\n"))
 * 
 * @param prefix
 * @param xml
 */
function listXML(prefix,xml) { // {{{
  var text = [];
  if (xml.nodeType===3) // just a text node
    text = [prefix+xml.textContent];
  else {
    var tag      = '<'+xml.nodeName;
    var attrs    = xml.attributes;
    if (xml.namespaceURI)
      tag += ' xmlns="'+xml.namespaceURI+'"';
    if (attrs)
      for (var i=0; i<attrs.length; i++)
        tag += ' '+attrs.item(i).nodeName+'="'+attrs.item(i).nodeValue+'"';
    if (xml.hasChildNodes && xml.hasChildNodes()) {
      text = [prefix+tag+'>'];
      for (var i=0; i<xml.childNodes.length; i++)
        text = text.concat(listXML(prefix+' ',xml.childNodes.item(i)));
      text.push(prefix+'</'+xml.nodeName+'>');
    } else
      text = [prefix+tag+'/>'];
  }
  return text;
} // }}}

