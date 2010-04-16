var svgNS = 'http://www.w3.org/2000/svg';

// ----------------- simple Petri net editor {{{

// (SVG only at the moment, works with opera and firefox; might need to add
// VML backend for pre-IE9?)
//
// TODO: - add generic net traversal, as well as
//          - static output formats (SVG, VML)
//          - import/export formats (PNML - import partially done)
//       - add token model and view objects
//       - support node resize (what about transition rotation?)
//       - support multipoint arcs
//       - support canvas scaling and scrolling (how does that interact
//          with the dummy background we need for event capture?)
//       - hook up to code generator / simulator
//       - generalize view handling (generic view objects instead of
//          Place/Transition/Arc-specific .p/.t/.a and .l)
//       - allow default styling to be overridden via css (two issues:
//          1. don't specify local style if applicable style exists
//          2. we currently avoid css-style in favour of svg attributes)
//       - have separate svg groups to add nodes/arcs or labels to,
//         to ensure that all labels overlap all other objects
//       - may need to prevent default event handling (overlap with
//          browser keyboard shortcuts or drag&drop)
//       - command history/undo?
//
// we have a simple model object hierarchy, with each model object linked to a
// single set of view objects (the view is a simple shadow of the model, so if
// we want to enable multiple views per model object, we could insert an
// interface for registering views with model objects, so that all of the
// latter get updated)
//
// Net(id)
//  main object; holds svg element, list of places, transitions, and arcs,
//  as well as current selection, cursor mode, and help text; converts mouse
//  event to svg canvas coordinates; handles adding/removing nodes and arcs
//
// Node(nodeType)
//  common prototype for places and transitions; has text label, can be
//  renamed, moved, deleted, and connected (with other nodes not of the same
//  type); keeps track of incoming and outgoing arcs, position, id, and
//  embedding Net object; subtypes have view objects in addition to text
//  label, can update their view after changes, can calculate where arcs
//  from/to a given position should connect with the view shape
//
//  Place(net,id,pos)
//  Transition(net,id,pos)
//
// Arc(source,target)
//  connects a source and a target node, has view object, can update its
//  view after changes, can be deleted; this is an auxiliary object that
//  mostly just follows whatever happens to the source and target nodes it is
//  registered with
//
// Cursor(net)
//  tracks Net it belongs to, mode of Net-global cursor operation (insert
//  place or transition, connect nodes by arcs, delete nodes, toggle help);
//  has a view that should help to indicate cursor mode
//  
// -------------------------------- }}}

// ----------------------------- auxiliaries {{{

// bind function 'this'-reference (allows us to register model object
// methods as view object event listeners while avoiding explicit
// view->model references)
function bind(f,x) {
  return function() {
    return f.apply(x,arguments);
  };
}

// opera does sequences of style.property=blah setters just fine;
// firefox (mostly) keeps the properties in the javascript object, 
// but uses only the last one set for actual css styling, 
// so we regroup the properties into a single setAttribute
// TODO: we're still sometimes losing style attributes in firefox
//       ('esc' might lose placeCursor attributes, then 'p' gives 
//       black cursor - when this happens, the individual style 
//       attributes of the javascript object are also gone?)
// ==> try to use object attributes instead of style properties,
//     replacing x.style.prop= with x.setAttributeNS(null,'prop',)
//     where possible
// TODO: instead of patching after modification, which is ugly and easy to
//       forget provide a patching modification operation (which, for opera,
//       could simply modify the style attributes but, for firefox, needs to
//       do some string munging on cssText..
function patchStyle(x) {
  var cssvals = ['cursor','display'];
  var jsvals  = ['cursor','display'];
  var style   = [];
  for (var i in cssvals) {
    var cssval = cssvals[i];
    var jsval  = jsvals[i];
    if (x.style[jsval]) style.push(cssval+': '+x.style[jsval]);
  }
  // listProperties('x.style'+(x.id?'('+x.id+'): ':': '),x.style);
  // message('patchStyle'+(x.id?'('+x.id+'): ':': ')+style.join('; '));
  x.style.cssText = style.join('; ');
}

// ----------------------------- }}}

// ----------------------------- Node {{{

// TODO: how to make constructor "parameters" net,id,pos explicit?
function Node(nodeType) {
  this.nodeType = nodeType;
}
Node.prototype.addLabel = function (x,y) {
  this.l = document.createElementNS(svgNS,'text');
  this.l.setAttributeNS(null,'class','label');
  this.l.setAttributeNS(null,'stroke','red');
  this.l.setAttributeNS(null,'stroke-width','1');
  this.l.setAttributeNS(null,'font-size','100');
  this.l.setAttributeNS(null,'x',x);
  this.l.setAttributeNS(null,'y',y);
  this.l.appendChild(document.createTextNode(this.name));
  this.l.addEventListener('click',bind(this.rename,this),false);
  this.net.svg.appendChild(this.l);
}
Node.prototype.rename = function(event) {
  var name = prompt('new '+this.nodeType+' name? ',this.name);
  if (name!=null) {
    this.l.firstChild.data = name;
    this.name              = name;
  }
  this.updateView();
}
Node.prototype.toString = function() {
  return this.nodeType+'('+this.id+','+this.pos+')';
}
Node.prototype.mousedownHandler = function(event) {
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might otherwise miss small shapes
  if (this.net.cursor.mode==='m') {
    this.net.selection = this;
    var action = this.mousemoveHandler;
  } else if (this.net.cursor.mode==='a') {
    this.net.selection = new Arc(this,this.net.cursor);
    this.net.selection.a.id = 'partialArc';
    // place the arc just after the backdrop, so it isn't hiding anything
    this.net.svg.insertBefore(this.net.selection.a
                             ,this.net.svg.firstChild.nextSibling);
    var action = this.newArcHandler;
  } else
    return true;
  // need to keep references to dynamically constructed listeners,
  // or removeEventListener wouldn't work
  this.listeners = { 'mousemove' : bind(action,this)
                   , 'mouseup'   : bind(this.mouseupHandler,this)
                   }
  for (var l in this.listeners) 
    this.net.svg.addEventListener(l,this.listeners[l],false);
  return true;
}
Node.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  // message(this.nodeType+'.mousemoveHandler '+p);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
  return true;
}
Node.prototype.newArcHandler = function(event) {
  var p = this.net.client2canvas(event);
  // message(this.nodeType+'.newArcHandler '+p);
  this.net.selection.updateView();
  return true;
}
Node.prototype.mouseupHandler = function(event) {
  if ((this.net.cursor.mode==='a')
    &&(this.net.selection instanceof Arc)) {
    this.net.svg.removeChild(this.net.selection.a); 
    if (!(this.net.selection.source instanceof this.constructor)) 
      this.net.addArc(this.net.selection.source,this);
  }
  this.net.selection = null;
  for (var l in this.listeners) 
    this.net.svg.removeEventListener(l,this.listeners[l],false);
  this.listeners = {};
  return true;
}
Node.prototype.registerArcAtSource = function(arc) {
  this.arcsOut.push(arc);
}
Node.prototype.registerArcAtTarget = function(arc) {
  this.arcsIn.push(arc);
}
Node.prototype.unregisterArcAtSource = function(arc) {
  delete this.arcsOut[this.arcsOut.indexOf(arc)];
}
Node.prototype.unregisterArcAtTarget = function(arc) {
  delete this.arcsIn[this.arcsIn.indexOf(arc)];
}

// ----------------------------- }}}

// ----------------------------- Place {{{

function Place(net,id,pos,r,name) {
  this.net     = net;
  this.id      = id;
  this.name    = name;
  this.pos     = pos;
  this.r       = r;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Place.prototype = new Node('place');
Place.prototype.constructor = Place;
Place.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.p = this.placeShape(this.pos.x,this.pos.y,this.r);
  this.p.id = this.id; // TODO: filter/translate to get valid ids only!
  this.p.place = this;
  // this.p.style.cursor = 'move';
  patchStyle(this.p);
  this.p.addEventListener('click',bind(this.clickHandler,this),false);
  this.p.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.p.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+this.r,this.pos.y+this.r);
}
Place.prototype.placeShape = function (x,y,r) {
  var shape = document.createElementNS(svgNS,'circle');
  shape.setAttributeNS(null,'class','place');
  shape.setAttributeNS(null,'cx',x); 
  shape.setAttributeNS(null,'cy',y); 
  shape.setAttributeNS(null,'r',r);
  shape.setAttributeNS(null,'stroke','black');
  shape.setAttributeNS(null,'stroke-width','10px');
  shape.setAttributeNS(null,'fill','white');
  return shape;
}
Place.prototype.updateView = function() {
  this.p.id = this.id; // TODO: filter/translate to get valid ids only!
  this.p.setAttributeNS(null,'cx',this.pos.x); 
  this.p.setAttributeNS(null,'cy',this.pos.y); 
  this.p.setAttributeNS(null,'r',this.r);
  this.l.setAttributeNS(null,'x',this.pos.x+this.r);
  this.l.setAttributeNS(null,'y',this.pos.y+this.r);
}
// nearest point on place border
Place.prototype.connectorFor = function(pos) {
  var vec = this.pos.vectorTo(pos)
  var l   = vec.length();
  return this.pos.add(vec.scale(this.r/l));
}
// TODO: can these three handlers move to Node?
//        (need to generalize view handling and removal)
Place.prototype.clickHandler = function(event) {
  if (this.net.cursor.mode==='d') this.net.removePlace(this);
  return true;
}
Place.prototype.mousedownHandler = function(event) {
  this.p.setAttributeNS(null,'stroke','green'); 
    // TODO: - have a 'selected' CSS class for this?
    //       - generically change rendering, move code to Node()
  Node.prototype.mousedownHandler.call(this,event);
}
Place.prototype.mouseupHandler = function(event) {
  this.p.setAttributeNS(null,'stroke','black');
  Node.prototype.mouseupHandler.call(this,event);
}

// ----------------------------- }}}

// ----------------------------- Transition {{{

function Transition(net,id,pos,width,height,name) {
  this.net     = net;
  this.id      = id;
  this.name    = name;
  this.pos     = pos;
  this.width   = width;
  this.height  = height;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Transition.prototype = new Node('transition');
Transition.prototype.constructor = Transition;
Transition.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.t = this.transitionShape(this.pos.x,this.pos.y,this.width,this.height);
  this.t.id = this.id; // TODO: filter/translate to get valid ids only!
  this.t.transition = this;
  // this.t.style.cursor = 'move';
  patchStyle(this.t);
  this.t.addEventListener('click',bind(this.clickHandler,this),false);
  this.t.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.t.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+0.6*this.width
               ,this.pos.y+0.5*this.height);
}
Transition.prototype.transitionShape = function (x,y,w,h) {
  var x2 = x - w/2;
  var y2 = y - h/2;
  var t = document.createElementNS(svgNS,'rect');
  t.setAttributeNS(null,'class','transition');
  t.setAttributeNS(null,'x',x2); 
  t.setAttributeNS(null,'y',y2); 
  t.setAttributeNS(null,'width',w);
  t.setAttributeNS(null,'height',h);
  t.setAttributeNS(null,'stroke','black');
  t.setAttributeNS(null,'stroke-width','10px');
  t.setAttributeNS(null,'fill','darkgrey');
  return t;
}
Transition.prototype.updateView = function() {
  var x2 = this.pos.x - this.width/2;
  var y2 = this.pos.y - this.height/2;
  this.t.id = this.id; // TODO: filter/translate to get valid ids only!
  this.t.setAttributeNS(null,'x',x2); 
  this.t.setAttributeNS(null,'y',y2); 
  this.t.setAttributeNS(null,'width',this.width);
  this.t.setAttributeNS(null,'height',this.height);
  this.l.setAttributeNS(null,'x',x2+2*this.width);
  this.l.setAttributeNS(null,'y',y2+this.height);
}
// nearest point on transition border
// (middle of top,bottom,left,right border)
// TODO: spread out connectors on the sides (need to find a scale
//        that ensures connectors stay within the range of the border)
Transition.prototype.connectorFor = function(pos) {
  var w = this.width/2;
  var h = this.height/2;
  var x = this.pos.x;
  var y = this.pos.y;
  return ( pos.x-x > w
         ? new Pos(x+w,y)
         : x-pos.x > w 
           ? new Pos(x-w,y)
           : pos.y > y
             ? new Pos(x,y+h)
             : new Pos(x,y-h));
}
// TODO: slim shapes are hard to hit, perhaps add a transparent halo?
Transition.prototype.clickHandler = function(event) {
  if (this.net.cursor.mode==='d') this.net.removeTransition(this);
  return true;
}
Transition.prototype.mousedownHandler = function(event) {
  this.t.setAttributeNS(null,'stroke','green');
  Node.prototype.mousedownHandler.call(this,event);
}
Transition.prototype.mouseupHandler = function(event) {
  this.t.setAttributeNS(null,'stroke','black');
  Node.prototype.mouseupHandler.call(this,event);
}

// ----------------------------- }}}

// ----------------------------- Arc {{{

function Arc(source,target) {
  this.source = source;
  this.target = target;

  this.a = document.createElementNS(svgNS,'path');
  this.a.arc = this;
  this.a.setAttributeNS(null,'style', 'stroke: black; stroke-width: 10px');
  this.a.setAttributeNS(null,'class','arc');
  this.a.setAttributeNS(null,'marker-end','url(#Arrow)');
  this.a.addEventListener('click',bind(this.clickHandler,this),false);
  this.updateView();
}
Arc.prototype.updateView = function() {
  var sourceCon = this.source.connectorFor(this.target.pos);
  var targetCon = this.target.connectorFor(this.source.pos);

  this.a.setAttributeNS(null,'d','M '+sourceCon.x+' '+sourceCon.y
                         +'L '+targetCon.x+' '+targetCon.y);
}
Arc.prototype.toString = function() {
  return this.source+'->'+this.target;
}
Arc.prototype.clickHandler = function(event) {
  // message("Arc.clickHandler "+this.source.id+'->'+this.target.id);
  if (this.source.net.cursor.mode==='d') this.source.net.removeArc(this);
  return true;
}

// ----------------------------- }}}

// ----------------------------- Cursor {{{

function Cursor(net) {
  this.net = net;
  this.pos = new Pos(0,0);

  var tWidth  = this.net.transitionWidth/5;
  var tHeight = this.net.transitionHeight/5;
  var r       = this.net.r/5;

  // TODO: instead of hiding the various cursor shapes in the
  //       palette group, keep off-screen references and simply
  //       assign the active shape to the palette?
  this.palette = document.createElementNS(svgNS,'g');
  this.mode    = ''; // TODO: - an enum would be nicer
                     //       - can we replace the various switch/if on
                     //         mode with a nice oo pattern without
                     //         obfuscating the code?

  this.transition  = Transition.prototype.transitionShape(100,-100,tWidth,tHeight);
    this.transition.id = 'transitionCursor';
    this.transition.style.display = 'none';
    patchStyle(this.transition);
    this.palette.appendChild(this.transition);

  this.place  = Place.prototype.placeShape(100,-100,r);
    this.place.id = 'placeCursor';
    this.place.style.display = 'none';
    patchStyle(this.place);
    this.palette.appendChild(this.place);
}
// TODO: this patching is getting ridiculous
Cursor.prototype.hideAll = function () {
  this.net.svg.style.cursor = 'auto';
  this.transition.style.display = 'none'; 
  patchStyle(this.transition);
  this.place.style.display = 'none'; 
  patchStyle(this.place);
}
Cursor.prototype.defaultCursor = function () {
  this.hideAll();
}
Cursor.prototype.deleteCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'crosshair';
}
Cursor.prototype.moveCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'move';
}
Cursor.prototype.transitionCursor = function () {
  this.hideAll();
  this.transition.style.display = 'inline';
  patchStyle(this.transition);
}
Cursor.prototype.placeCursor = function () {
  this.hideAll();
  this.place.style.display = 'inline';
  patchStyle(this.place);
}
Cursor.prototype.connectorFor = function(pos) {
  return this.pos;
}
Cursor.prototype.updatePos = function(p) {
  this.palette.setAttributeNS(null,'transform','translate('+p.x+','+p.y+')');
  this.pos.x = p.x;
  this.pos.y = p.y;
}

// ----------------------------- }}}

// ----------------------------- Net {{{

function Net(id,width,height) {

  this.id     = id;
  this.width  = width;
  this.height = height;
  this.svg    = document.createElementNS(svgNS,'svg');
  this.svg.id = id;
  this.svg.setAttributeNS(null,'version','1.1');
  this.svg.setAttributeNS(null,'width','10cm');
  this.svg.setAttributeNS(null,'height','10cm');
  this.svg.setAttributeNS(null,'viewBox','0 0 '+width+' '+height);
  this.svg.setAttributeNS(null,'clip','0 0 '+width+' '+height); // TODO: is this right?
  this.svg.style.margin = '10px';

  // opera doesn't register mousemove events where there is no svg content,
  // so we provide a dummy backdrop (this doesn't seem needed in firefox?)
  // TODO: does the standard say anything about this?
  this.addBackdrop();

  this.addDefs();

  this.cursor      = new Cursor(this);
  this.svg.appendChild(this.cursor.palette);

  // TODO: maintain separate groups for places, transitions, arcs, 
  //       and labels, eg, to ensure that all labels overlap all nodes

  this.svg.net = this;
  this.clicks = 0;
  this.svg.addEventListener('click',bind(this.clickHandler,this),false);
  this.svg.addEventListener('mousemove',bind(this.mousemoveHandler,this),false);
  // can't listen for keypress on svg only?
  document.documentElement.addEventListener('keypress'
                                           ,bind(this.keypressHandler,this)
                                           ,false);

  this.places      = [];
  this.transitions = [];
  this.arcs        = [];
  this.selection   = null;

  this.addHelp();
}

// TODO: shouldn't the following view parameters be in their model objects?
Net.prototype.r                     = 100;
// TODO: asymmetric transition shape would be preferred, to avoid
//        impressions of duration, but that calls for rotation ability
Net.prototype.transitionWidth       = 2*Net.prototype.r;
Net.prototype.transitionHeight      = 2*Net.prototype.r;

Net.prototype.toString = function() {
  var r = '';
  r += this.id+"\n";
  r += "places: ";
  for (var k in this.places) r += '['+k+"="+this.places[k]+']';
  r += "\ntransitions: ";
  for (var k in this.transitions) r += '['+k+"="+this.transitions[k]+']';
  r += "\narcs: ";
  for (var k in this.arcs) r +=  '['+this.arcs[k].source.id
                               +'->'+this.arcs[k].target.id+']';
  return r;
}

Net.prototype.toPNML = function() {
  var element = function(tag,attributes,children) {
                   var e = document.createElement(tag);
                   for (var a in attributes) e.setAttribute(a,attributes[a]);
                   for (var c in children) e.appendChild(children[c]);
                   return e;
                }
  var dimension = function(x,y) { return element('dimension',{'x':x,'y':y}); }
  var position  = function(x,y) { return element('position',{'x':x,'y':y}); }
  var graphics  = function(children) { return element('graphics',{},children); }
  var name = function(text) {
              return element('name',{}
                            ,[element('text',{},[document.createTextNode(text)])]);
             }
  var place      = function(id,x,y) {
                     return element('place',{'id':id},[graphics([position(x,y)])]);
                   }
  var transition = function(id,x,y) {
                    return element('transition',{'id':id},[graphics([position(x,y)])]);
                   }
  var net = function(type,id,children) {
              return element('net',{'type':type,'id':id},children);
            }

  var ps = []; 
    for(var pi in this.places) {
      var p=this.places[pi];
      ps.push(place(p.id,p.pos.x,p.pos.y));
    };
  var ts = [];
    for(var ti in this.transitions) {
      var t=this.transitions[ti];
      ts.push(transition(t.id,t.pos.x,t.pos.y));
    };
  var n = net('http://www.petriweb.org/specs/pnml','net'
             ,[name('example')
              ,graphics([dimension(this.width,this.height)
                        ,position(0,0)])
              ].concat(ts,ps));

  var pnml = document.implementation.createDocument(null,'pnml',null);
  pnml.documentElement.appendChild(n);
  messagePre(listXML('',pnml.documentElement).join("\n"));
  
}

Net.prototype.fromPNML = function(pnml,scale,unit) {
  if (pnml.querySelectorAll) {
    var scale = scale ? scale : 10; 
    var unit  = unit ? unit : 100; 
    var places = pnml.querySelectorAll('place');
    for (var i=0; i<places.length; i++) {
      var place = places[i];
      var id    = place.getAttributeNS(null,'id');
      var name  = place.querySelector('name>text');
      var pos   = place.querySelector('graphics>position');
      var x     = pos.attributes['x'].nodeValue;
      var y     = pos.attributes['y'].nodeValue;
      message(id+': '+(name?name.textContent:'')+' '+x+'/'+y);
      this.addPlace(id,x*scale,y*scale,unit,name?name.textContent:null);
    }
    var transitions = pnml.querySelectorAll('transition');
    for (var i=0; i<transitions.length; i++) {
      var transition = transitions[i];
      var id    = transition.getAttributeNS(null,'id');
      var name  = transition.querySelector('name>text');
      var pos   = transition.querySelector('graphics>position');
      var x     = pos.attributes['x'].nodeValue;
      var y     = pos.attributes['y'].nodeValue;
      message(id+': '+(name?name.textContent:'')+' '+x+'/'+y);
      this.addTransition(id,x*scale,y*scale,2*unit,2*unit,name?name.textContent:null);
    }
    var arcs = pnml.querySelectorAll('arc');
    for (var i=0; i<arcs.length; i++) {
      var arc = arcs[i];
      var id  = arc.getAttributeNS(null,'id');
      var sourceId = arc.getAttributeNS(null,'source');
      var targetId = arc.getAttributeNS(null,'target');
      message(id+': '+sourceId+' -> '+targetId);
      if (this.transitions[sourceId] && this.places[targetId])
        this.addArc(this.transitions[sourceId],this.places[targetId]);
      else if (this.places[sourceId] && this.transitions[targetId])
        this.addArc(this.places[sourceId],this.transitions[targetId]);
      else
        message('cannot find source and target');
    }
  } else
    message('querySelectorAll not supported');
}

Net.prototype.addBackdrop = function () {
  this.svgBackdrop = document.createElementNS(svgNS,'rect');
    this.svgBackdrop.id = 'svgBackdrop';
    // TODO: read svg viewport spec again, viewBox, viewport and aspect..
    //       how to calculate the visible x/y-coordinates automatically?
    var maxExtent = Math.max(this.width,this.height);
    this.svgBackdrop.setAttributeNS(null,'width',maxExtent); 
    this.svgBackdrop.setAttributeNS(null,'height',maxExtent);
    this.svgBackdrop.setAttributeNS(null,'x',0);
    this.svgBackdrop.setAttributeNS(null,'y',-1000);
    this.svgBackdrop.setAttributeNS(null,'style','fill: lightgrey');
    this.svg.appendChild(this.svgBackdrop);
}
Net.prototype.addHelp = function () {
  this.help = document.createElementNS(svgNS,'text');
  this.help.setAttributeNS(null,'fill','blue');
  this.help.setAttributeNS(null,'font-size','200');
  this.help.id = 'netHelp';
  var lines = ['press "m" then use mouse to move nodes'
              ,'press "t" then click to add transitions'
              ,'press "p" then click to add places'
              ,'press "a" then drag from node to add arcs'
              ,'press "d" then click to delete nodes or arcs'
              ,'press "?" to toggle this help text'
              ];
  for (var l in lines) {
    var tspan = document.createElementNS(svgNS,'tspan');
    tspan.setAttributeNS(null,'dy','1em');
    tspan.setAttributeNS(null,'x','0em');
    tspan.appendChild(document.createTextNode(lines[l]));
    this.help.appendChild(tspan);
  }
  this.help.style.display = 'none';
  this.svg.appendChild(this.help);
}
Net.prototype.toggleHelp = function() {
  if (this.help.style.display==='none') {
    this.svg.removeChild(this.help);
    this.svg.insertBefore(this.help,null);
    this.help.style.display='inline';
  } else
    this.help.style.display='none';
}
Net.prototype.addDefs = function () {
  var defs   = document.createElementNS(svgNS,'defs');
  var marker = document.createElementNS(svgNS,'marker');

  marker.id = "Arrow";
  marker.setAttributeNS(null,'viewBox','0 0 10 10');
  marker.setAttributeNS(null,'refX','10');
  marker.setAttributeNS(null,'refY','5');
  marker.setAttributeNS(null,'markerUnits','strokeWidth');
  marker.setAttributeNS(null,'markerWidth','10');
  marker.setAttributeNS(null,'markerHeight','10');
  marker.setAttributeNS(null,'orient','auto');
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null,'d','M 0 0 L 10 5 L 0 10 z');
  marker.appendChild(path);

  defs.appendChild(marker);
  this.svg.appendChild(defs);
}

Net.prototype.client2canvas = function (event) {
  // translate event coordinates to svg coordinates
  // TODO: why is this "screen" vs "client"?
  var ctm = this.svg.getScreenCTM();
  var p = this.svg.createSVGPoint();
  p.x = event.clientX; p.y = event.clientY;
  return p.matrixTransform(ctm.inverse());
}

Net.prototype.clickHandler = function (event) {
  // message('Net.clickHandler '+this.cursor.mode);
  var p = this.client2canvas(event);
  if (this.cursor.mode=='p') {
    var defaultName = 'p'+this.clicks++;
    var name = prompt('name of new place: ',defaultName);
    if (name!=null) this.addPlace(name,p.x,p.y);
  } else if (this.cursor.mode=='t') {
    var defaultName = 't'+this.clicks++;
    var name = prompt('name of new transition: ',defaultName);
    if (name!=null) this.addTransition(name,p.x,p.y)
  }
  return true;
}

Net.prototype.addArc = function (source,target) {
  if ((source instanceof Transition && target instanceof Place)
    ||(source instanceof Place && target instanceof Transition)) {

    var arc = new Arc(source,target);
    this.arcs.push(arc);
    source.registerArcAtSource(arc);
    target.registerArcAtTarget(arc);
    this.svg.appendChild(arc.a);
    return arc;
  }
}
Net.prototype.removeArc = function (arc) {
  delete this.arcs[this.arcs.indexOf(arc)];
  // TODO: this should move to Arc()
  arc.source.unregisterArcAtSource(arc);
  arc.target.unregisterArcAtTarget(arc);
  this.svg.removeChild(arc.a);
}

Net.prototype.addPlace = function (id,x,y,r,name) {
  var place = new Place(this,id,new Pos(x,y)
                       ,r?r:this.r,name?name:id);
  this.places[id] = place;
  this.svg.appendChild(place.p);
  return place;
}
Net.prototype.removePlace = function (place) {
  delete this.places[place.id];
  // TODO: this should move to NODE()
  for (var arcIn in place.arcsIn) this.removeArc(place.arcsIn[arcIn]);
  for (var arcOut in place.arcsOut) this.removeArc(place.arcsOut[arcOut]);
  this.svg.removeChild(place.p);
  this.svg.removeChild(place.l);
}

Net.prototype.addTransition = function (id,x,y,w,h,name) {
  var transition = new Transition(this,id,new Pos(x,y)
                                 ,w?w:this.transitionWidth
                                 ,h?h:this.transitionHeight
                                 ,name?name:id);
  this.transitions[id] = transition;
  this.svg.appendChild(transition.t);
  return transition;
}
Net.prototype.removeTransition = function (transition) {
  delete this.transitions[transition.id];
  // TODO: this should move to NODE()
  for (var arcIn in transition.arcsIn) this.removeArc(transition.arcsIn[arcIn]);
  for (var arcOut in transition.arcsOut) this.removeArc(transition.arcsOut[arcOut]);
  this.svg.removeChild(transition.t);
  this.svg.removeChild(transition.l);
}

Net.prototype.removeAll = function () {
  for (var p in this.places) this.removePlace(this.places[p]);
  for (var t in this.transitions) this.removeTransition(this.transitions[t]);
}

// seems we can only listen for keys outside svg
// we only set a mode for use in later click events 
// TODO: move to Cursor?
Net.prototype.keypressHandler = function (event) {
  // TODO: spec says charCode if printable, keyCode otherwise;
  //       opera 10.10 always seems to use keyCode, firefox follows spec?
  var key = event.charCode || event.keyCode;
  this.cursor.mode = String.fromCharCode(key);
  // message('Net.keypressHandler '+this.cursor.mode+' '+event.charCode+'/'+event.keyCode);
  switch (this.cursor.mode) {
    case 't': this.cursor.transitionCursor(); break;
    case 'p': this.cursor.placeCursor(); break;
    case 'm': this.cursor.moveCursor(); break;
    case 'd': this.cursor.deleteCursor(); break;
    case '?': this.toggleHelp(); break;
    default: this.cursor.defaultCursor();
             // TODO: also need '\esc' to cancel anything in progress,
             //       such as moves, partial arcs, ..
  }
  // event.preventDefault(); // how to do this only inside svg?
  return true;
}

Net.prototype.mousemoveHandler = function (event) {
  var p = this.client2canvas(event);
  // message('Net.mousemoveHandler '+p.x+'/'+p.y);
  this.cursor.updatePos(p);
  return true;
}

// ----------------------------- }}}

